/* Screenshot harness for the P3 Intel-UI follow-up (anchoring guard + evidence drawer
 * + gridlines + "looks consistent"). Harness ONLY: it overrides the sensitive gate and
 * the engine to produce a populated band deterministically — app code is untouched.
 * Captures both themes + EN/AR (RTL). Fails on any JS pageerror. */
const path = require('path');
const { chromium } = require(path.join(process.env.HOME, 'tempo-hardening-ux/node_modules/playwright'));
const OUT = path.join(__dirname, '..', 'docs', 'shots', 'intel-ui-p3');
const URL = 'file://' + path.join(__dirname, '..', 'dist', 'index.html');

const SYNTH = {
  enoughEvidence: true, range: [3.5, 4.2], confidence: 'medium',
  reasoning: [
    { text: 'Delivered the Riyadh activation on schedule with clean handover.', evidence: ['delivery0', 'delivery1'] },
    { text: 'Recognised by two peers for unblocking the ticketing flow.', evidence: ['recognition0'] }
  ],
  risks: [{ text: 'One open blocker still logged against the venue vendor.', evidence: ['risk0'] }],
  evidence: [
    { id: 'delivery0', source: 'Ops log', ts: '2026-06-10', category: 'delivery', text: 'Shipped activation runbook' },
    { id: 'delivery1', source: 'Ops log', ts: '2026-06-11', category: 'delivery', text: 'Clean post-event handover' },
    { id: 'recognition0', source: 'Slack #ops', ts: '2026-06-12', category: 'recognition', text: 'Peer kudos: ticketing fix' },
    { id: 'risk0', source: 'Risk register', ts: '2026-06-13', category: 'risk', text: 'Venue vendor blocker open' }
  ],
  baseline: { anchoredTo: 'orgMean', value: 3.8 }
};

async function shot(page, name) { await page.screenshot({ path: path.join(OUT, name), fullPage: true }); console.log('  ▸', name); }

(async () => {
  const errors = [];
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 1100 } });
  page.on('pageerror', e => errors.push('[pageerror] ' + e.message));
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|favicon/.test(m.text())) errors.push('[console] ' + m.text()); });

  await page.goto(URL, { waitUntil: 'networkidle' });

  // Authenticate + wire a sensitive-gated manager and a populated suggestion (harness-only).
  await page.evaluate(() => {
    const WP = window.WP;
    WP.access.canSeeSensitive = function () { return true; };
    WP.evalIntel.suggestedRange = function () { return Promise.resolve(window.__SYNTH); };
    WP.evalPrep = WP.evalPrep || {};
    WP.evalPrep.prepare = function () { return Promise.resolve({ enough: false, sourcedCount: 0, sections: [], highlights: [], gaps: [] }); };
    let vm = null, tp = null;
    (WP.data.PEOPLE || []).some(m => (WP.data.PEOPLE || []).some(p => {
      if (p.id === m.id) return false;
      const rel = WP.access.relationshipTo(m, p.id);
      if (rel === 'manager' || rel === 'director') { vm = m; tp = p; return true; }
      return false;
    }));
    window.__vm = vm.id; window.__tp = tp.id;
    WP.state.authed = true; WP.state.viewerId = vm.id;
  }, );

  for (const theme of ['dark', 'light']) {
    for (const lang of ['en', 'ar']) {
      const suffix = theme + (lang === 'ar' ? '-ar' : '');
      await page.evaluate(({ theme, lang, S }) => {
        window.__SYNTH = S;
        const WP = window.WP;
        WP.state.lang = lang;
        document.documentElement.lang = lang; document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
        WP.setState({ theme: theme, route: 'evaluation', selectedId: window.__tp, selectedCycle: null, evalOrigin: 'evaluations' });
      }, { theme, lang, S: SYNTH });
      await page.waitForTimeout(250);

      // 1) collapsed (anchoring guard) — only EN/dark + EN/light to keep the set tight
      if (lang === 'en') await shot(page, 'band-collapsed-' + theme + '.png');

      // 2) revealed (gridlines + cited-evidence chips)
      await page.click('#sb-reveal').catch(() => {});
      await page.waitForTimeout(150);
      await shot(page, 'band-' + suffix + '.png');

      // 3) evidence drawer (only one capture per theme, EN)
      if (lang === 'en') {
        await page.click('button.wbk-band-ev[data-refs]').catch(() => {});
        await page.waitForTimeout(150);
        await shot(page, 'evidence-drawer-' + theme + '.png');
        await page.evaluate(() => { const h = document.getElementById('overlay-host'); if (h) h.innerHTML = ''; });
      }
    }
  }

  // 4) "looks consistent ✓" — hub with enough data, zero warnings (harness override).
  await page.evaluate(() => {
    const WP = window.WP;
    WP.evalIntel.consistencyCheck = function () { return Promise.resolve({ enoughData: true, warnings: [] }); };
  });
  for (const theme of ['dark', 'light']) {
    await page.evaluate((theme) => {
      const WP = window.WP; WP.state.lang = 'en';
      document.documentElement.lang = 'en'; document.documentElement.dir = 'ltr';
      WP.setState({ theme: theme, route: 'evaluations' });
    }, theme);
    await page.waitForTimeout(300);
    await shot(page, 'consist-ok-' + theme + '.png');
  }

  await browser.close();
  if (errors.length) { console.log('SHOT FAIL — JS errors:\n' + errors.join('\n')); process.exit(1); }
  console.log('SHOT OK — no JS pageerrors');
})();
