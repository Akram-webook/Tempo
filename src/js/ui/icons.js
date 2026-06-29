/* ============================================================
 * Webook Workload — SVG icon set (Lucide-style)
 * ------------------------------------------------------------
 * Replaces emoji-as-icons (a UI/UX anti-pattern): emojis render
 * differently per device/OS and look unprofessional. These are
 * crisp, inherit color via currentColor, and size with font-size.
 * Usage: WP.ui.icon('target') or WP.ui.icon('flame', 16).
 * ========================================================== */
(function (WP) {
  'use strict';
  const P = {
    target:   '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none"/>',
    chart:    '<path d="M3 3v18h18"/><rect x="7" y="11" width="3" height="6"/><rect x="12" y="7" width="3" height="10"/><rect x="17" y="13" width="3" height="4"/>',
    clipboard:'<rect x="8" y="3" width="8" height="4" rx="1"/><path d="M9 5H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-3"/><path d="M8 11h8M8 15h6"/>',
    key:      '<circle cx="7.5" cy="15.5" r="3.5"/><path d="M10 13 21 2"/><path d="m16.5 5.5 3 3M14 8l2.5 2.5"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
    moon:     '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9z"/>',
    sun:      '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    plus:     '<path d="M12 5v14M5 12h14"/>',
    flame:    '<path d="M12 2s4 4 4 8a4 4 0 0 1-8 0c0-1 .5-2 .5-2S6 11 6 14a6 6 0 0 0 12 0c0-5-6-12-6-12z"/>',
    sprout:   '<path d="M7 20h10"/><path d="M12 20v-8"/><path d="M12 12C12 8 9 6 4 6c0 4 3 6 8 6z"/><path d="M12 11c0-3 2-5 6-5 0 3-2 5-6 5z"/>',
    alert:    '<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/>',
    lock:     '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
    wallet:   '<path d="M21 12V7a2 2 0 0 0-2-2H5a2 2 0 0 0 0 4h16a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7"/><circle cx="17" cy="14" r="1.5" fill="currentColor" stroke="none"/>',
    check:    '<path d="M20 6 9 17l-5-5"/>',
    pencil:   '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
    star:     '<path d="M12 2l3 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.9 21l1.2-6.8-5-4.9 6.9-1z"/>',
    clock:    '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    sparkles: '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M18 6l-2.5 2.5M8.5 15.5 6 18"/>',
    users:    '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.9"/>',
    user:     '<circle cx="12" cy="8" r="4"/><path d="M4 21v-1a6 6 0 0 1 12 0v1"/>',
    arrowUp:  '<path d="M12 19V5M5 12l7-7 7 7"/>',
    arrowRight:'<path d="M5 12h14M13 6l6 6-6 6"/>',
    arrowLeft:'<path d="M19 12H5M11 6l-6 6 6 6"/>',
    bulb:     '<path d="M9 18h6M10 22h4"/><path d="M12 2a7 7 0 0 0-4 12.7c.6.5 1 1.3 1 2.1h6c0-.8.4-1.6 1-2.1A7 7 0 0 0 12 2z"/>',
    eye:      '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/>',
    tree:     '<rect x="9" y="2" width="6" height="5" rx="1"/><rect x="2" y="17" width="6" height="5" rx="1"/><rect x="16" y="17" width="6" height="5" rx="1"/><path d="M12 7v5M5 17v-2.5a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1V17"/>',
    list:     '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
    logout:   '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5M21 12H9"/>',
    minus:    '<path d="M5 12h14"/>',
    grid:     '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
    gauge:    '<path d="M3.5 18a9 9 0 1 1 17 0"/><path d="M12 14l3.5-3.5"/><circle cx="12" cy="14" r="1.4" fill="currentColor" stroke="none"/>',
    menu:     '<path d="M3 6h18M3 12h18M3 18h18"/>',
    panel:    '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16"/>',
    chevL:    '<path d="M15 18l-6-6 6-6"/>',
    chevR:    '<path d="M9 18l6-6-6-6"/>',
    x:        '<path d="M18 6 6 18M6 6l12 12"/>',
    search:   '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>',
    caret:    '<path d="M6 9l6 6 6-6"/>',
  };
  WP.ui = WP.ui || {};
  WP.ui.icon = function (name, size) {
    const d = P[name];
    if (!d) return '';
    const s = size || 18;
    return '<svg class="icn" width="' + s + '" height="' + s + '" viewBox="0 0 24 24" fill="none" ' +
      'stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + d + '</svg>';
  };
})(window.WP = window.WP || {});
