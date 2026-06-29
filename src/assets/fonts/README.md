# Gellix — drop-in font slot (licensed files NOT included)

Tempo's V3 UI/display typeface is **Gellix**. The CSS already lists `Gellix` first in
`--font-sans`, `--font-ar`, and `--font-display` (see `src/css/tokens.css`), so the moment
the licensed font files are present here, the build links them and Gellix takes over with
**zero code changes**. Until then, the existing fallback (Figtree / IBM Plex Sans Arabic)
stays — no broken boxes, no fake substitute.

## What Akram drops in (and where)

Place these **exact filenames** in this folder (`src/assets/fonts/`):

| File                    | Weight | CSS `font-weight` |
|-------------------------|--------|-------------------|
| `Gellix-Regular.woff2`  | 400    | 400 (normal)      |
| `Gellix-Medium.woff2`   | 500    | 500               |
| `Gellix-SemiBold.woff2` | 600    | 600               |
| `Gellix-Bold.woff2`     | 700    | 700               |

- Format: **WOFF2** only (smallest; all target browsers support it).
- Filenames are matched case-sensitively by `build.js`.
- You do **not** need all four — `build.js` inlines whichever are present and skips the
  rest. (Regular + SemiBold alone already cover most of the UI.)

## How it works (zero-code follow-up)

1. Drop the `.woff2` file(s) above into this folder.
2. Run `npm run build`.
3. `build.js` base64-inlines each present file into a `@font-face` block (family `Gellix`,
   `font-display: swap`) injected at the `<!-- @GELLIX-FONT@ -->` marker in `index.html`.
   If **no** files are present, the marker is replaced with an empty string — the bundle is
   unchanged and the fallback face stays.

That's the whole follow-up: **add the files, run build.** No CSS or JS edits.

## Licence

Gellix is a **commercial typeface** (Manvel Shmavonyan / djr / the licensed foundry). Tempo
does **not** ship it. Only add font files Webook holds a valid licence for, and keep the
licence/EULA on record. **Do not commit any Gellix font file without that licence** — and
never commit a renamed substitute font as "Gellix" (that would be both a licence breach and
a visual lie). This folder intentionally contains no font binaries.
