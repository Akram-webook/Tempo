/* Tempo bundler — inlines CSS, JS, and SVG assets into one self-contained
 * dist/index.html (no build step at runtime; opens directly / GitHub Pages). */
const fs = require('fs'), path = require('path');
const root = __dirname;
let html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

function read(p) { return fs.readFileSync(path.join(root, p), 'utf8'); }
function svgDataUri(p) {
  const svg = read(p);
  return 'data:image/svg+xml;base64,' + Buffer.from(svg, 'utf8').toString('base64');
}

// 1) Inline stylesheets: <link rel="stylesheet" href="src/css/x.css" />
html = html.replace(/<link\s+rel="stylesheet"\s+href="(src\/css\/[^"]+)"\s*\/?>/g,
  (_, href) => '<style>\n' + read(href) + '\n</style>');

// 2) Inline scripts: <script src="src/js/.../x.js"></script>  (preserve order)
html = html.replace(/<script\s+src="(src\/js\/[^"]+)"><\/script>/g,
  (_, src) => '<script>\n' + read(src) + '\n</script>');

// 3) Base64-inline local SVG assets (favicon + any src="src/assets/*.svg")
html = html.replace(/href="(src\/assets\/[^"]+\.svg)"/g, (_, p) => 'href="' + svgDataUri(p) + '"');
html = html.replace(/src="(src\/assets\/[^"]+\.svg)"/g, (_, p) => 'src="' + svgDataUri(p) + '"');
// JS builds logos by concatenation: 'src/assets/' + (dark ? 'wbk-white.svg' : 'wbk-pink.svg')
// Replace that whole expression with the inlined data URIs so dist needs no asset files.
const pink = svgDataUri('src/assets/wbk-pink.svg');
const white = svgDataUri('src/assets/wbk-white.svg');
const cond = "(WP.state.theme === 'dark' ? 'wbk-white.svg' : 'wbk-pink.svg')";
const condUri = "(WP.state.theme === 'dark' ? '" + white + "' : '" + pink + "')";
// Form A (login.js):  'src/assets/' + (cond)
html = html.split("'src/assets/' + " + cond).join(condUri);
// Form B (app.js / wbkLibrary.js):  src="src/assets/' + (cond)
html = html.split("src=\"src/assets/' + " + cond).join("src=\"' + " + condUri);

fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
// 4) Gellix drop-in (Item 2): base64-inline whichever licensed .woff2 files are present
//    in src/assets/fonts/ into a @font-face block at the marker. NO files → empty marker
//    (fallback face stays; no 404, no fake substitute). Zero-code follow-up for Akram.
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
html = html.replace('<!-- @GELLIX-FONT@ -->', gellixBlock);

fs.writeFileSync(path.join(root, 'dist', 'index.html'), html);
const kb = (Buffer.byteLength(html, 'utf8') / 1024).toFixed(0);
const leftJs = (html.match(/<script\s+src="src\//g) || []).length;
const leftCss = (html.match(/<link[^>]+src\/css/g) || []).length;
console.log('Built dist/index.html (' + kb + ' KB). Un-inlined left: js=' + leftJs + ' css=' + leftCss);
