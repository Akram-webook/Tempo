/* Screenshot harness for the P5 Weekly Intelligence Report follow-up (window stepper +
 * slim AI bar + RTL bar-fill check). Harness ONLY: overrides the engine to return a
 * populated, de-identified report deterministically — app code untouched. Both themes
 * + EN/AR(RTL). Fails on any JS pageerror. */
const path = require('path');
const { chromium } = require(path.join(process.env.HOME, 'tempo-hardening-ux/node_modules/playwright'));
const OUT = path.join(__dirname, '..', 'docs', 'shots', 'intel-ui-p5');
const URL = 'file://' + path.join(__dirname, '..', 'dist', 'index.html');

const REP = {
  period: { start: '2026-06-21', end: '2026-06-27' }, enoughData: true,
  decisionCounts: {
    assign: { count: 9, evidence: ['a', 'b', 'c'] },
    'access-grant': { count: 4, evidence: ['d', 'e'] },
    evaluation: { count: 3, evidence: ['f', 'g', 'h'] },
    'role-change': { count: 1, evidence: ['i'] }
  },
  topFocusAreas: [
    { focus: 'staffing', count: 9, evidence: ['a', 'b', 'c'] },
    { focus: 'access', count: 4, evidence: ['d', 'e'] },
    { focus: 'performance', count: 3, evidence: ['f'] }
  ],
  recurringThemes: [
    { theme: 'staffing', text: 'Repeated last-minute backfills on weekend activations.', evidence: ['a', 'b'] }
  ],
  aiAcceptanceRate: { rate: 0.7, accepted: 2, of: 3, evidence: ['f', 'g', 'h'] },
  shifts: [
    { type: 'assign', delta: 3, text: 'Assignments up vs the prior period.', evidence: ['a', 'b', 'c'] },
    { type: 'access-grant', delta: -1, text: 'Access grants slightly down.', evidence: ['d'] }
  ]
};

async function shot(page, name) { await page.screenshot({ path: path.join(OUT, name), fullPage: true }); console.log('  ▸', name); }

(async () => {
  const errors = [];
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
  page.on('pageerror', e => errors.push('[pageerror] ' + e.message));
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|favicon/.test(m.text())) errors.push('[console] ' + m.text()); });
  await page.goto(URL, { waitUntil: 'networkidle' });

  await page.evaluate((REP) => {
    const WP = window.WP;
    window.__REP = REP;
    WP.decisionMemory.weeklyReport = function () { return JSON.parse(JSON.stringify(window.__REP)); };
    const dir = (WP.data.PEOPLE || []).find(p => WP.access.canManage(p));
    window.__dir = dir.id;
    WP.state.authed = true; WP.state.viewerId = dir.id;
  }, REP);

  for (const theme of ['dark', 'light']) {
    for (const lang of ['en', 'ar']) {
      await page.evaluate(({ theme, lang }) => {
        const WP = window.WP;
        WP.state.lang = lang; WP.state.weeklyWin = null;
        document.documentElement.lang = lang; document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
        WP.setState({ theme: theme, route: 'weekly' });
      }, { theme, lang });
      await page.waitForTimeout(250);
      await shot(page, 'weekly-' + theme + (lang === 'ar' ? '-ar' : '') + '.png');
    }
  }
  await browser.close();
  if (errors.length) { console.log('SHOT FAIL — JS errors:\n' + errors.join('\n')); process.exit(1); }
  console.log('SHOT OK — no JS pageerrors');
})();
