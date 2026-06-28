const { chromium } = require(require('os').homedir() + '/tempo-hardening-ux/node_modules/playwright');
const path = require('path');
const url = 'file://' + path.join(__dirname, '..', 'dist', 'index.html');
const out = path.join(__dirname, '..', 'docs/shots/wbk-v3-organisms');
(async () => {
  const browser = await chromium.launch();
  for (const theme of ['light', 'dark']) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 1700 } });
    await page.goto(url);
    await page.evaluate((th) => {
      window.WP.state.authed = true;
      const chk = document.getElementById('chk-skip'); if (chk) chk.click();
      window.WP.setState({ theme: th, route: 'library' });
    }, theme);
    await page.waitForTimeout(700);
    await page.screenshot({ path: path.join(out, 'gallery-' + theme + '.png'), fullPage: true });
    for (const sel of ['.wbk-pageheader', '.wbk-table']) {
      const el = await page.$(sel);
      if (el) { const card = await el.evaluateHandle(n => n.closest('.wbk-sec')); await card.asElement().screenshot({ path: path.join(out, sel.replace(/\W/g,'') + '-' + theme + '.png') }); }
    }
    await page.close();
  }
  // FOOTER FIX proof — short page (My progress), full viewport, NOT fullPage, so dead space would show
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await page.goto(url);
  await page.evaluate(() => {
    window.WP.state.authed = true;
    const chk = document.getElementById('chk-skip'); if (chk) chk.click();
    window.WP.setState({ theme: 'dark', route: 'me' });
  });
  await page.waitForTimeout(700);
  await page.screenshot({ path: path.join(out, 'footer-shortpage-me.png') });
  // measure: footer bottom vs viewport bottom
  const gap = await page.evaluate(() => {
    const f = document.querySelector('#sig-bar .sig-bar'); if (!f) return 'no-footer';
    const r = f.getBoundingClientRect();
    return { footerBottom: Math.round(r.bottom), viewportH: window.innerHeight, footerVisible: r.top < window.innerHeight };
  });
  console.log('footer measure:', JSON.stringify(gap));
  await page.close();
  await browser.close();
  console.log('shots done');
})();
