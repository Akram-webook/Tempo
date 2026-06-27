# SPEC — Signature Bar v2 (make it quiet + non-intrusive) · TAOS size XS · B2
Refines the shipped signature bar (#12). Goal: smaller, calmer, matches the page, and NEVER overlaps
or distracts from content or anything that opens (modals, drawers, the check-in). Follow CLAUDE.md.

## Problems to fix (observed live)
1. **Too big / heavy** — large padding + 17px bold names make it shout. It should read as a subtle
   footer signature, not a prominent band.
2. **Competes / risks overlap** — it must sit quietly at the bottom of the page content and stay
   BENEATH any overlay (assignment drawer, check-in modal, profile, dropdowns). Opening something must
   never reveal the bar floating over it or fighting for attention.

## Changes
**A. Shrink + calm the visual weight (use tokens):**
- Vertical padding ~18px → **8px** (slim). Horizontal ~24px → 20px.
- Names: 17px/700 → **13px/600**. Role labels: 10px → **9.5px**. Dept: 12px → **11px**.
- Dept color → `--text-muted` (quieter). Keep the gold for role labels but it can be one notch less
  saturated; names → `--text-secondary` (not full-white) so the bar recedes.
- Pink underline under M. Akram: keep but smaller — width ~20px, height 2px.
- Hairline top border stays (`--border`). Result: a thin, low-key signature strip.

**B. Placement + stacking so it never overlaps / distracts:**
- Render the bar at the **end of the scrolling content column** (inside `.view-main`, AFTER `#view`),
  NOT as a floating/sticky/fixed bar. It scrolls with the page and lives beneath the content.
- Ensure it has a **low z-index** and the overlay host (`#overlay-host`) + any drawer/modal/dropdown
  render ABOVE it. Open the assignment drawer and the daily check-in and confirm the bar is fully
  behind the overlay/backdrop — no bleed-through, no competition.
- Add a little bottom breathing room so it doesn't crowd the last content row.
- Still shows on every signed-in page; hidden on the sign-in screen (unchanged).

**C. Keep:** EN+AR, RTL mirroring, dark+light, mobile stack (also compact), inline-SVG, WCAG contrast
on the smaller text (verify the 9.5px gold still meets AA — nudge darker if not).

## Acceptance
- Noticeably slimmer/quieter; reads as a signature, not a banner; matches the page surface.
- Opening the assignment drawer / check-in modal / a dropdown: the bar stays BEHIND it, never overlaps
  or distracts (verified by screenshot in dark + light).
- All states intact; build clean; all suites green; PR opened (don't merge). Tiny XS drop.
