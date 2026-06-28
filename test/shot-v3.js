const { chromium } = require(require('os').homedir() + '/tempo-hardening-ux/node_modules/playwright');
const path = require('path');
const url = 'file://' + path.join(__dirname, '..', 'dist', 'index.html');
(async () => {
  const browser = await chromium.launch();
  for (const theme of ['light', 'dark']) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 1600 } });
    await page.goto(url);
    await page.evaluate((th) => {
      window.WP.state.authed = true;
      const chk = document.getElementById('chk-skip'); if (chk) chk.click();
      window.WP.setState({ theme: th, route: 'library' });
    }, theme);
    await page.waitForTimeout(700);
    await page.screenshot({ path: path.join(__dirname, '..', 'docs/shots/wbk-v3-atoms', 'gallery-' + theme + '.png'), fullPage: true });
    // focused button matrix shot
    const btn = await page.$('.wbk-sec');
    if (btn) await btn.screenshot({ path: path.join(__dirname, '..', 'docs/shots/wbk-v3-atoms', 'buttons-' + theme + '.png') });
    await page.close();
  }
  await browser.close();
  console.log('shots done');
})();
