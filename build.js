/* Tempo bundler — inlines CSS, JS, and SVG assets into self-contained pages
 * (no build step at runtime; opens directly / GitHub Pages):
 *   dist/index.html  — the app
 *   dist/chart.html  — the standalone, public "Operations Chart" export (sample data) */
const fs = require('fs'), path = require('path');
const root = __dirname;

function read(p) { return fs.readFileSync(path.join(root, p), 'utf8'); }
function svgDataUri(p) {
  const svg = read(p);
  return 'data:image/svg+xml;base64,' + Buffer.from(svg, 'utf8').toString('base64');
}

// Logo data URIs (JS builds the logo path by concatenation; we inline it).
const pink = svgDataUri('src/assets/wbk-pink.svg');
const white = svgDataUri('src/assets/wbk-white.svg');
const cond = "(WP.state.theme === 'dark' ? 'wbk-white.svg' : 'wbk-pink.svg')";
const condUri = "(WP.state.theme === 'dark' ? '" + white + "' : '" + pink + "')";

// Gellix drop-in: base64-inline whichever licensed .woff2 files are present into a
// @font-face block at the marker. NO files → empty marker (fallback face stays; no
// 404, no fake substitute). Computed once, reused by every page.
const GELLIX = [
  { file: 'Gellix-Regular.woff2',  weight: 400 },
  { file: 'Gellix-Medium.woff2',   weight: 500 },
  { file: 'Gellix-SemiBold.woff2', weight: 600 },
  { file: 'Gellix-Bold.woff2',     weight: 700 },
];
const fontDir = path.join(root, 'src/assets/fonts');
const faces = GELLIX.filter(g => fs.existsSync(path.join(fontDir, g.file))).map(g => {
  const b64 = fs.readFileSync(path.join(fontDir, g.file)).toString('base64');
  return '@font-face{font-family:"Gellix";font-style:normal;font-weight:' + g.weight +
    ';font-display:swap;src:url("data:font/woff2;base64,' + b64 + '") format("woff2");}';
});
const gellixBlock = faces.length ? '<style>\n' + faces.join('\n') + '\n</style>' : '';

// Inline one dev-shell HTML into a self-contained page (CSS + JS + SVG + Gellix).
function inlineShell(srcFile) {
  let html = read(srcFile);
  // 1) Inline stylesheets
  html = html.replace(/<link\s+rel="stylesheet"\s+href="(src\/css\/[^"]+)"\s*\/?>/g,
    (_, href) => '<style>\n' + read(href) + '\n</style>');
  // 2) Inline scripts (preserve order)
  html = html.replace(/<script\s+src="(src\/js\/[^"]+)"><\/script>/g,
    (_, src) => '<script>\n' + read(src) + '\n</script>');
  // 3) Base64-inline local SVG assets + the concatenated logo expressions
  html = html.replace(/href="(src\/assets\/[^"]+\.svg)"/g, (_, p) => 'href="' + svgDataUri(p) + '"');
  html = html.replace(/src="(src\/assets\/[^"]+\.svg)"/g, (_, p) => 'src="' + svgDataUri(p) + '"');
  html = html.split("'src/assets/' + " + cond).join(condUri);
  html = html.split("src=\"src/assets/' + " + cond).join("src=\"' + " + condUri);
  // 4) Gellix marker
  html = html.replace('<!-- @GELLIX-FONT@ -->', gellixBlock);
  return html;
}

function buildPage(srcFile, outFile) {
  const html = inlineShell(srcFile);
  fs.writeFileSync(path.join(root, 'dist', outFile), html);
  const kb = (Buffer.byteLength(html, 'utf8') / 1024).toFixed(0);
  const leftJs = (html.match(/<script\s+src="src\//g) || []).length;
  const leftCss = (html.match(/<link[^>]+src\/css/g) || []).length;
  console.log('Built dist/' + outFile + ' (' + kb + ' KB). Un-inlined left: js=' + leftJs + ' css=' + leftCss);
}

fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
buildPage('index.html', 'index.html');
buildPage('chart.html', 'chart.html');
