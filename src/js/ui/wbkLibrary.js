/* ============================================================
 * WBK Component Library — every component from the WBK DS, live.
 * Buttons, chips, segmented control, stepper, slider, toggle/checkbox/radio,
 * badges, progress (bar + circle), avatar, tabs, toast, system banner, tooltip,
 * dialog, countdown, date picker, card / list item / section heading.
 * All built on the WBK tokens (brand #ff2c79, radius 8/4, Figtree).
 * ========================================================== */
(function (WP) {
  'use strict';
  const ui = WP.ui;
  const ic = function (n, s) { return WP.ui.icon(n, s || 16); };

  function sec(title, body, note) {
    return '<section class="wbk-sec">' +
      '<div class="wbk-sec-h"><h3>' + ui.esc(title) + '</h3>' +
        (note ? '<span class="wbk-sec-note">' + ui.esc(note) + '</span>' : '') + '</div>' +
      '<div class="wbk-sec-body">' + body + '</div></section>';
  }

  function MONTH() {
    const d = new Date(WP.state.refDate + 'T00:00:00');
    const y = d.getFullYear(), m = d.getMonth();
    const first = new Date(y, m, 1).getDay();
    const days = new Date(y, m + 1, 0).getDate();
    const today = new Date(); const isThisMonth = today.getFullYear() === y && today.getMonth() === m;
    let cells = '';
    for (let i = 0; i < first; i++) cells += '<span class="wbk-cal-d is-empty"></span>';
    for (let day = 1; day <= days; day++) {
      const t = isThisMonth && today.getDate() === day ? ' is-today' : '';
      cells += '<button class="wbk-cal-d' + t + '" data-day="' + day + '">' + day + '</button>';
    }
    const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    return '<div class="wbk-cal"><div class="wbk-cal-m">' + months[m] + ' ' + y + '</div>' +
      '<div class="wbk-cal-w"><span>S</span><span>M</span><span>T</span><span>W</span><span>T</span><span>F</span><span>S</span></div>' +
      '<div class="wbk-cal-g">' + cells + '</div></div>';
  }

  function avatarsOf(ids) {
    return ids.map(function (id) {
      const p = WP.access.byId(id); return p ? ui.avatar(p, 'var(--brand)') : '';
    }).join('');
  }

  function render(root) {
    const t = WP.i18n.t;
    const people = WP.data.PEOPLE.filter(function (p) { return p.photo; }).slice(0, 4).map(function (p) { return p.id; });

    const intents = [['cta', t('btnCta')], ['primary', t('btnPrimary')], ['secondary', t('btnSecondary')], ['tertiary', t('btnTertiary')]];
    const btnRow = function (mod, withState) {
      return '<div class="wbk-row" style="align-items:center;margin-bottom:8px">' +
        intents.map(function (it) {
          return '<button class="wbk-btn wbk-btn--' + it[0] + (mod ? ' wbk-btn--' + mod : '') + '">' + ic('plus', 16) + it[1] + '</button>';
        }).join('') +
        (withState ?
          '<button class="wbk-btn wbk-btn--cta" disabled>' + t('btnDisabled') + '</button>' +
          '<button class="wbk-btn wbk-btn--primary is-animating">' + t('btnAnimating') + '<span class="wbk-btn-spin"></span></button>'
        : '') +
      '</div>';
    };
    const buttons = sec('Button',
      btnRow('xl', false) + btnRow('lg', false) + btnRow('md', false) + btnRow('sm', false) +
      btnRow('lg', true),
      'CTA / Primary / Secondary / Tertiary · xL / L / M / S · normal / hover / active / animating / disabled');

    const btngroup = sec('Button group',
      '<div class="wbk-btngroup">' +
        '<button class="wbk-btn wbk-btn--secondary wbk-btn--md">' + ic('grid', 16) + t('bgDay') + '</button>' +
        '<button class="wbk-btn wbk-btn--secondary wbk-btn--md">' + t('bgWeek') + '</button>' +
        '<button class="wbk-btn wbk-btn--secondary wbk-btn--md">' + t('bgMonth') + '</button>' +
      '</div>');

    const link = sec('Link',
      '<div class="wbk-row" style="align-items:center;gap:20px">' +
        '<a class="wbk-link" href="#" onclick="return false">' + t('linkLearn') + ' ' + ic('arrowRight', 14) + '</a>' +
        '<a class="wbk-link" href="#" onclick="return false">' + ic('eye', 14) + ' ' + t('linkView') + '</a>' +
      '</div>');

    const inputs = sec('Input',
      '<div style="display:flex;flex-direction:column;gap:14px;max-width:360px">' +
        '<label class="wbk-field"><span class="wbk-field-label">' + t('inEmail') + '</span>' +
          '<input class="wbk-input" type="email" placeholder="name@webook.com" />' +
          '<span class="wbk-field-hint">' + t('inEmailHint') + '</span></label>' +
        '<label class="wbk-field is-error"><span class="wbk-field-label">' + t('inName') + '<span class="wbk-req">*</span></span>' +
          '<input class="wbk-input" value="" placeholder="' + t('inNamePh') + '" />' +
          '<span class="wbk-field-hint">' + t('inNameErr') + '</span></label>' +
        '<label class="wbk-field"><span class="wbk-field-label">' + t('inDisabled') + '</span>' +
          '<input class="wbk-input" value="Read-only" disabled /></label>' +
      '</div>',
      'Default · focus · error · disabled');

    const richtext = sec('Rich text',
      '<div class="wbk-rich" style="max-width:520px"><h3>' + t('rtTitle') + '</h3>' +
        '<p>' + t('rtBody') + '</p>' +
        '<p><a href="#" onclick="return false">' + t('rtLink') + '</a></p></div>');

    const chips = sec('Chips (button group)',
      '<div class="wbk-row" id="wbk-chips">' +
        ['All','Sports','Concerts','Shows','Dining','Experiences'].map(function (c, i) {
          return '<button class="wbk-chip' + (i === 0 ? ' is-selected" aria-selected="true' : '') + '">' + c + '</button>';
        }).join('') +
        '<button class="wbk-chip">Cuisine ' + ic('caret', 12) + '</button>' +
      '</div>', 'Single-select demo');

    const segmented = sec('Segmented control',
      '<div class="seg" id="wbk-seg">' +
        '<button class="active">Segment 1</button><button>Segment 2</button><button>Segment 3</button>' +
      '</div>');

    const stepper = sec('Stepper',
      '<div class="wbk-stepper" id="wbk-stepper">' +
        '<button data-step="-1" aria-label="decrease">' + ic('minus', 16) + '</button>' +
        '<span class="wbk-stepper-v">2</span>' +
        '<button data-step="1" aria-label="increase">' + ic('plus', 16) + '</button>' +
      '</div>');

    const slider = sec('Slider',
      '<input type="range" class="wbk-slider" min="0" max="100" value="60" />');

    const choice = sec('Checkbox · Radio · Toggle',
      '<div class="wbk-row wbk-choice">' +
        '<label class="wbk-check"><input type="checkbox" checked><span></span>Checkbox</label>' +
        '<label class="wbk-radio"><input type="radio" name="r" checked><span></span>Radio A</label>' +
        '<label class="wbk-radio"><input type="radio" name="r"><span></span>Radio B</label>' +
        '<label class="wbk-toggle"><input type="checkbox" checked><span></span>Toggle</label>' +
      '</div>');

    const badges = sec('Badges',
      '<div class="wbk-row" style="align-items:center;gap:22px">' +
        '<span class="wbk-badge-host">' + ic('clipboard', 22) + '<i class="wbk-badge wbk-badge-dot"></i></span>' +
        '<span class="wbk-badge-host">' + ic('users', 22) + '<i class="wbk-badge">3</i></span>' +
        '<span class="wbk-badge-host">' + ic('chart', 22) + '<i class="wbk-badge">12</i></span>' +
      '</div>');

    const alertRow = function (mod, icon, title, msg, closable) {
      return '<div class="wbk-alert' + (mod ? ' wbk-alert--' + mod : '') + '">' +
        '<span class="wbk-alert-ic">' + ic(icon, 18) + '</span>' +
        '<div class="wbk-alert-bd"><div class="wbk-alert-t">' + title + '</div><div class="wbk-alert-m">' + msg + '</div></div>' +
        (closable ? '<button class="wbk-alert-x" aria-label="' + t('alClose') + '">' + ic('x', 16) + '</button>' : '') +
      '</div>';
    };
    const alerts = sec('Alert',
      '<div style="display:flex;flex-direction:column;gap:10px">' +
        alertRow('', 'bulb', t('alInfoT'), t('alInfoM'), true) +
        alertRow('positive', 'check', t('alOkT'), t('alOkM'), false) +
        alertRow('notice', 'alert', t('alWarnT'), t('alWarnM'), false) +
        alertRow('negative', 'lock', t('alErrT'), t('alErrM'), true) +
      '</div>', 'Info · positive · notice · negative — icon-led (never colour-alone)');

    const menu = sec('Dropdown menu',
      '<div class="wbk-menu" role="menu">' +
        '<button class="wbk-menu-item" role="menuitem" aria-selected="true">' + ic('eye', 16) + t('mnView') + ic('check', 14) + '</button>' +
        '<button class="wbk-menu-item" role="menuitem">' + ic('pencil', 16) + t('mnEdit') + '<span class="wbk-menu-trail">⌘E</span></button>' +
        '<button class="wbk-menu-item" role="menuitem" disabled>' + ic('users', 16) + t('mnShare') + '</button>' +
        '<div class="wbk-menu-sep"></div>' +
        '<button class="wbk-menu-item wbk-menu-item--danger" role="menuitem">' + ic('logout', 16) + t('mnDelete') + '</button>' +
      '</div>', 'Item · selected · disabled · danger · separator');

    const progress = sec('Progress',
      '<div style="display:flex;gap:32px;align-items:center;flex-wrap:wrap">' +
        '<div style="flex:1;min-width:180px"><div class="wbk-prog"><i style="width:64%"></i></div>' +
          '<div class="wbk-prog-l">64%</div></div>' +
        '<svg class="wbk-prog-c" viewBox="0 0 48 48" width="56" height="56">' +
          '<circle cx="24" cy="24" r="20" class="trk"/>' +
          '<circle cx="24" cy="24" r="20" class="val" stroke-dasharray="125.6" stroke-dashoffset="45"/>' +
          '<text x="24" y="28" text-anchor="middle">64%</text></svg>' +
      '</div>');

    const avatars = sec('Avatar',
      '<div class="wbk-row" style="align-items:center;gap:16px">' +
        avatarsOf(people) +
        '<span class="avatar" style="width:48px;height:48px">AN</span>' +
        '<span class="wbk-avstack">' + avatarsOf(people.slice(0, 3)) + '<i class="wbk-avmore">+5</i></span>' +
      '</div>');

    const tabs = sec('Tabs',
      '<div class="wbk-tabs" id="wbk-tabs">' +
        '<button class="active">Overview</button><button>Details</button><button>Reviews</button><button>Map</button>' +
      '</div>');

    const toasts = sec('Toast',
      ['info','success','warning','error'].map(function (s) {
        return '<div class="wbk-toast wbk-is-' + s + '"><span class="wbk-status-dot"></span>' +
          '<span><b>' + s[0].toUpperCase() + s.slice(1) + '</b> — short message here.</span>' +
          '<button class="wbk-x" aria-label="dismiss">' + ic('x', 14) + '</button></div>';
      }).join(''));

    const banners = sec('System banner',
      ['info','warning','success','error'].map(function (s) {
        return '<div class="wbk-banner wbk-is-' + s + '"><span class="wbk-banner-msg"><span class="wbk-status-dot"></span>Message here…</span>' +
          '<button class="wbk-btn wbk-btn--secondary">Update information</button></div>';
      }).join(''));

    const tooltip = sec('Tooltip',
      '<span class="wbk-tip-host">Hover me<span class="wbk-tip">Short description shown on hover</span></span>',
      'Hover the text');

    const dialog = sec('Dialog',
      '<button class="btn primary" id="wbk-dialog-open">Open dialog</button>');

    const countdown = sec('Countdown',
      '<div class="wbk-cd" id="wbk-cd">' +
        ['DAYS','HRS','MINS','SECS'].map(function (l) {
          return '<div class="wbk-cd-b"><b data-cd="' + l + '">00</b><span>' + l + '</span></div>';
        }).join('') + '</div>');

    const datepick = sec('Date picker', MONTH());

    // PIN code input — 6 boxes, with a default + error state demo. data-i sets order; LTR digits even in RTL.
    const pinBoxes = function (n, err, val) {
      let h = '<div class="wbk-pin' + (err ? ' is-error' : '') + '" role="group" aria-label="' + t('pinCode') + '">';
      for (let i = 0; i < n; i++) h += '<input inputmode="numeric" maxlength="1" aria-label="' + t('pinCode') + ' ' + (i + 1) + '" value="' + ((val && val[i]) || '') + '"' + (i === 0 ? ' id="wbk-pin-first"' : '') + ' />';
      return h + '</div>';
    };
    const pin = sec('PIN code', pinBoxes(6, false, '12') +
      '<div class="wbk-row" style="margin-top:10px"><span class="sub">Error state</span></div>' + pinBoxes(6, true, '12'),
      'node 2053-12021');

    // Booking label — semantic status pills, each paired with an icon (never colour alone).
    const blabel = sec('Booking label',
      '<div class="wbk-row">' +
        '<span class="wbk-blabel wbk-blabel--positive">' + ic('check', 14) + t('blConfirmed') + '</span>' +
        '<span class="wbk-blabel wbk-blabel--notice">' + ic('clock', 14) + t('blPending') + '</span>' +
        '<span class="wbk-blabel wbk-blabel--negative">' + ic('x', 14) + t('blSoldOut') + '</span>' +
        '<span class="wbk-blabel">' + ic('pencil', 14) + t('blDraft') + '</span>' +
      '</div>', 'node 2064-46940');

    // ---- Wave 2 molecules ----
    const sep = '<span class="wbk-bc-sep" aria-hidden="true">' + ic('chevR', 14) + '</span>';
    const breadcrumb = sec('Breadcrumb',
      '<nav class="wbk-bc" aria-label="Breadcrumb"><a href="#">' + t('bcHome') + '</a>' + sep +
        '<a href="#">' + t('bcEvents') + '</a>' + sep +
        '<span aria-current="page">' + t('bcTickets') + '</span></nav>', 'node 2038-5315');

    const uploader = sec('File uploader',
      '<div class="wbk-upload" tabindex="0" role="button">' + ic('arrowUp', 22) +
        '<div class="wbk-upload-t">' + t('uploadCta') + '</div>' +
        '<div class="wbk-upload-h">' + t('uploadHint') + '</div></div>', 'node 3185-2677');

    const tiles = sec('Tile',
      '<div class="wbk-row" id="wbk-tiles">' +
        '<button class="wbk-tile is-selected" aria-pressed="true">' + ic('flame', 24) + t('bcEvents') + '</button>' +
        '<button class="wbk-tile" aria-pressed="false">' + ic('star', 24) + t('ticketVip') + '</button>' +
        '<button class="wbk-tile" aria-pressed="false">' + ic('users', 24) + t('ticketGeneral') + '</button>' +
      '</div>', 'node 2065-49753');

    const price = sec('Price · Wallet amount',
      '<div class="wbk-row" style="align-items:baseline;gap:20px">' +
        '<span class="wbk-price"><span class="wbk-price-v">210.75</span><span class="wbk-price-c">SAR</span></span>' +
        '<span class="wbk-price is-sm"><del>260.00</del><span class="wbk-price-v">199.00</span><span class="wbk-price-c">SAR</span></span>' +
        '<span class="wbk-price">' + ic('wallet', 18) + '<span class="wbk-price-v">1,240</span><span class="wbk-price-c">SAR</span></span>' +
      '</div>', 'node 2060-15446');

    const media = sec('Media',
      '<div style="display:grid;grid-template-columns:2fr 1fr;gap:12px">' +
        '<div class="wbk-media">' + ic('eye', 26) + '</div>' +
        '<div class="wbk-media is-square">' + ic('star', 26) + '</div></div>', 'node 2053-20120');

    const bubble = sec('Chat message bubble',
      '<div style="display:flex;flex-direction:column;gap:8px">' +
        '<div class="wbk-bubble wbk-bubble--recv">' + ui.esc(t('chatRecv')) + '<span class="wbk-bubble-time">09:24</span></div>' +
        '<div class="wbk-bubble wbk-bubble--sent">' + ui.esc(t('chatSent')) + '<span class="wbk-bubble-time">09:25</span></div>' +
      '</div>', 'node 4326-2854');

    const mappin = sec('Map pin',
      '<div class="wbk-row">' +
        '<span class="wbk-mappin is-active">' + ic('target', 14) + t('mapRestaurant') + ' · 210 SAR</span>' +
        '<span class="wbk-mappin">' + ic('target', 14) + t('mapHotel') + ' · 480 SAR</span>' +
      '</div>', 'nodes 6817-34991 / 6816-34234');

    const ticketRow = function (name, px, qty, id) {
      return '<div class="wbk-ticket" data-ticket="' + id + '"><div class="wbk-ticket-m"><div class="nm">' + name + '</div><div class="px">' + px + ' SAR</div></div>' +
        '<div class="wbk-qty"><button data-q="-1" aria-label="Decrease"' + (qty <= 0 ? ' disabled' : '') + '>' + ic('minus', 14) + '</button>' +
        '<span class="wbk-qty-v">' + qty + '</span>' +
        '<button data-q="1" aria-label="Increase">' + ic('plus', 14) + '</button></div></div>';
    };
    const ticket = sec('Ticket selector',
      '<div id="wbk-tickets">' + ticketRow(t('ticketGeneral'), '150', 1, 'ga') + ticketRow(t('ticketVip'), '420', 0, 'vip') + '</div>', 'node 2061-36975');

    const dock = sec('Actions bar · Button dock',
      '<div class="wbk-actions"><button class="btn">Cancel</button>' +
        '<span class="wbk-actions-end"><button class="btn">Save draft</button><button class="btn primary">Publish</button></span></div>' +
      '<div class="wbk-dock" style="margin-top:10px"><span class="wbk-price is-sm"><span class="wbk-price-v">570</span><span class="wbk-price-c">SAR</span></span>' +
        '<button class="btn primary">Checkout</button></div>', 'nodes 2061-24126 / 4398-34377');

    const card = sec('Card · List item · Section heading',
      '<div class="wbk-card">' +
        '<div class="wbk-card-media">' + ic('users', 26) + '</div>' +
        '<div class="wbk-card-b"><div class="wbk-card-t">Al Haddad Scuba: Diving Course</div>' +
          '<div class="wbk-card-m">Adventure · Sports · Family</div>' +
          '<div class="wbk-card-f"><b>210.75 SAR</b><button class="btn primary">Book</button></div></div>' +
      '</div>' +
      '<div class="wbk-list">' +
        '<div class="wbk-li">' + ic('target', 18) + '<div><div class="wbk-li-t">List item title</div><div class="wbk-li-m">Short description</div></div>' + ic('chevR', 16) + '</div>' +
        '<div class="wbk-li">' + ic('clipboard', 18) + '<div><div class="wbk-li-t">Another row</div><div class="wbk-li-m">Short description</div></div>' + ic('chevR', 16) + '</div>' +
      '</div>');

    root.innerHTML =
      '<div class="wbk-lib">' +
        '<header class="wbk-lib-h"><div><h2>WBK Component Library</h2>' +
          '<p>Every component from the WBK Design System, live on the WBK tokens.</p></div>' +
          '<img class="wbk-lib-logo" src="src/assets/' + (WP.state.theme === 'dark' ? 'wbk-white.svg' : 'wbk-pink.svg') + '" alt="WBK" /></header>' +
        '<div class="wbk-grid">' +
          buttons + btngroup + link + inputs + richtext + chips + segmented + stepper + slider + choice + badges + blabel + alerts + menu + progress +
          avatars + tabs + toasts + banners + tooltip + dialog + countdown + datepick + pin +
          breadcrumb + uploader + tiles + price + media + bubble + mappin + ticket + dock + card +
        '</div>' +
      '</div>' +
      '<div class="wbk-modal" id="wbk-modal" hidden><div class="wbk-modal-bd"></div>' +
        '<div class="wbk-modal-card" role="dialog" aria-modal="true" aria-label="Dialog">' +
          '<div class="wbk-modal-media">' + ic('users', 28) + '</div>' +
          '<h4>Heading</h4><p>This is a WBK dialog. Confirm to continue or cancel to dismiss.</p>' +
          '<div class="wbk-row" style="justify-content:flex-end;margin-top:14px">' +
            '<button class="btn" id="wbk-dialog-cancel">Cancel</button>' +
            '<button class="btn primary" id="wbk-dialog-ok">Confirm</button></div>' +
        '</div></div>';

    wire(root);
  }

  function wire(root) {
    // chips: single-select
    const chips = root.querySelector('#wbk-chips');
    if (chips) chips.querySelectorAll('.wbk-chip').forEach(function (c) {
      c.onclick = function () {
        chips.querySelectorAll('.wbk-chip').forEach(function (x) { x.classList.remove('is-selected'); x.removeAttribute('aria-selected'); });
        c.classList.add('is-selected'); c.setAttribute('aria-selected', 'true');
      };
    });
    // segmented + tabs: single active
    [['#wbk-seg', 'button'], ['#wbk-tabs', 'button']].forEach(function (pair) {
      const el = root.querySelector(pair[0]); if (!el) return;
      el.querySelectorAll(pair[1]).forEach(function (b) {
        b.onclick = function () { el.querySelectorAll(pair[1]).forEach(function (x) { x.classList.remove('active'); }); b.classList.add('active'); };
      });
    });
    // stepper
    const st = root.querySelector('#wbk-stepper');
    if (st) { const v = st.querySelector('.wbk-stepper-v');
      st.querySelectorAll('[data-step]').forEach(function (b) {
        b.onclick = function () { v.textContent = Math.max(0, (parseInt(v.textContent, 10) || 0) + parseInt(b.dataset.step, 10)); };
      });
    }
    // date picker: select a day
    const cal = root.querySelector('.wbk-cal');
    if (cal) cal.querySelectorAll('.wbk-cal-d:not(.is-empty)').forEach(function (d) {
      d.onclick = function () { cal.querySelectorAll('.wbk-cal-d').forEach(function (x) { x.classList.remove('is-sel'); }); d.classList.add('is-sel'); };
    });
    // PIN inputs: digits only, auto-advance forward, backspace steps back
    root.querySelectorAll('.wbk-pin').forEach(function (grp) {
      const boxes = Array.prototype.slice.call(grp.querySelectorAll('input'));
      boxes.forEach(function (box, i) {
        box.oninput = function () {
          box.value = box.value.replace(/[^0-9]/g, '').slice(0, 1);
          if (box.value && boxes[i + 1]) boxes[i + 1].focus();
        };
        box.onkeydown = function (e) {
          if (e.key === 'Backspace' && !box.value && boxes[i - 1]) boxes[i - 1].focus();
        };
      });
    });
    // tiles: single-select (radio-like)
    const tiles = root.querySelector('#wbk-tiles');
    if (tiles) tiles.querySelectorAll('.wbk-tile').forEach(function (b) {
      b.onclick = function () {
        tiles.querySelectorAll('.wbk-tile').forEach(function (x) { x.classList.remove('is-selected'); x.setAttribute('aria-pressed', 'false'); });
        b.classList.add('is-selected'); b.setAttribute('aria-pressed', 'true');
      };
    });
    // ticket selector: quantity stepper, clamped at 0, disables minus at 0
    const tk = root.querySelector('#wbk-tickets');
    if (tk) tk.querySelectorAll('.wbk-ticket').forEach(function (row) {
      const v = row.querySelector('.wbk-qty-v'); const minus = row.querySelector('[data-q="-1"]');
      row.querySelectorAll('[data-q]').forEach(function (btn) {
        btn.onclick = function () {
          const next = Math.max(0, (parseInt(v.textContent, 10) || 0) + parseInt(btn.dataset.q, 10));
          v.textContent = next; if (minus) minus.disabled = next <= 0;
        };
      });
    });
    // toast / banner dismiss
    root.querySelectorAll('.wbk-x').forEach(function (x) { x.onclick = function () { x.closest('.wbk-toast').style.display = 'none'; }; });
    // dialog
    const modal = root.querySelector('#wbk-modal');
    const open = root.querySelector('#wbk-dialog-open');
    const close = function () { if (modal) modal.hidden = true; };
    if (open) open.onclick = function () { modal.hidden = false; };
    ['#wbk-dialog-cancel', '#wbk-dialog-ok'].forEach(function (s) { const b = root.querySelector(s); if (b) b.onclick = close; });
    if (modal) modal.querySelector('.wbk-modal-bd').onclick = close;
    // countdown — ticking to a fixed target
    if (WP._wbkCd) { clearInterval(WP._wbkCd); WP._wbkCd = null; }
    const cd = root.querySelector('#wbk-cd');
    if (cd) {
      const target = Date.now() + (23 * 864e5 + 11 * 36e5 + 15 * 6e4 + 8000);
      const pad = function (n) { return String(n).padStart(2, '0'); };
      const tick = function () {
        // stop ticking once the user leaves Components (or the node is gone)
        if ((WP.state && WP.state.route !== 'library') || !document.body.contains(cd)) {
          clearInterval(WP._wbkCd); WP._wbkCd = null; return;
        }
        let s = Math.max(0, Math.floor((target - Date.now()) / 1000));
        const d = Math.floor(s / 86400); s -= d * 86400;
        const h = Math.floor(s / 3600); s -= h * 3600;
        const m = Math.floor(s / 60); s -= m * 60;
        const set = function (k, val) { const el = cd.querySelector('[data-cd="' + k + '"]'); if (el) el.textContent = pad(val); };
        set('DAYS', d); set('HRS', h); set('MINS', m); set('SECS', s);
      };
      tick(); WP._wbkCd = setInterval(tick, 1000);
    }
  }

  WP.ui = WP.ui || {};
  WP.ui.wbkLibrary = { render: render };
})(window.WP = window.WP || {});
