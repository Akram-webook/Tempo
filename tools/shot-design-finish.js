/* Screenshot harness for the P6 design-finish surfaces — Development & growth panel
 * (on a profile) + Org-capability view. Harness ONLY: overrides the readiness engine to
 * return populated, de-identified, k-anonymized output deterministically — app code
 * untouched. Both themes + EN/AR(RTL). Fails on any JS pageerror. */
const path = require('path');
const { chromium } = require(path.join(process.env.HOME, 'tempo-hardening-ux/node_modules/playwright'));
const OUT = path.join(__dirname, '..', 'docs', 'shots', 'design-finish');
const URL = 'file://' + path.join(__dirname, '..', 'dist', 'index.html');

const PROFILE = {
  enoughEvidence: true,
  strengths: [
    { area: 'delivery', text: 'Sustained delivery: 5 completed item(s)', evidence: [
      { id: 'd1', ts: '2026-05-12', category: 'delivery', source: 'Tier-1 activation · Riyadh', confidence: 'recorded', text: 'Closed the main-stage run sheet two days early.' },
      { id: 'd2', ts: '2026-05-28', category: 'delivery', source: 'Ops handover', confidence: 'recorded', text: 'Led the vendor load-in without a single slip.' } ] },
    { area: 'recognition', text: 'Recognition on record (2)', evidence: [
      { id: 'r1', ts: '2026-06-02', category: 'recognition', source: 'Director note', confidence: 'observed', text: 'Praised for calm under a last-minute reschedule.' } ] }
  ],
  growthAreas: [
    { area: 'support', text: 'Open blockers worth supporting (1)', evidence: [
      { id: 'k1', ts: '2026-06-10', category: 'risk', source: 'Weekly check-in', confidence: 'observed', text: 'Flagged dependency on a single supplier contact.' } ] }
  ],
  evidenceCoverage: { byCategory: { delivery: 5, recognition: 2, plan: 1, risk: 1 }, byQuarter: {}, sourcedCount: 9 },
  gaps: ['No wellbeing evidence on record', 'No completed evaluation on record'],
  subjectId: null
};
const ORG = {
  enoughData: true, cohortSize: 18,
  capabilityDistribution: { strong: { count: 5, of: 18 }, proficient: { count: 9, of: 18 }, developing: { suppressed: true, note: 'too few to show' } },
  skillGapAreas: { conduct: { count: 7, of: 18 }, behavior: { suppressed: true, note: 'too few to show' }, results: { count: 6, of: 18 }, capability: { count: 0, of: 18 } }
};

async function shot(page, name) { await page.screenshot({ path: path.join(OUT, name), fullPage: true }); console.log('  ▸', name); }

(async () => {
  const errors = [];
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 1100 } });
  page.on('pageerror', e => errors.push('[pageerror] ' + e.message));
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|favicon/.test(m.text())) errors.push('[console] ' + m.text()); });
  await page.goto(URL, { waitUntil: 'networkidle' });

  await page.evaluate(({ PROFILE, ORG }) => {
    const WP = window.WP;
    const dir = (WP.data.PEOPLE || []).find(p => WP.access.canManage(p));
    // a person this director can see the sensitive view of
    const target = (WP.data.PEOPLE || []).find(p => WP.access.canSeeSensitive(dir, p.id)) || dir;
    window.__dir = dir.id; window.__target = target.id;
    PROFILE.subjectId = target.id;
    WP.readiness.developmentProfile = function () { return Promise.resolve(JSON.parse(JSON.stringify(PROFILE))); };
    WP.readiness.orgCapability = function () { return JSON.parse(JSON.stringify(ORG)); };
    WP.state.authed = true; WP.state.viewerId = dir.id;
  }, { PROFILE, ORG });

  for (const theme of ['dark', 'light']) {
    for (const lang of ['en', 'ar']) {
      const sfx = theme + (lang === 'ar' ? '-ar' : '');
      // Development & growth panel on a profile
      await page.evaluate(({ theme, lang }) => {
        const WP = window.WP;
        WP.state.lang = lang; WP._devCache = null;
        document.documentElement.lang = lang; document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
        WP.setState({ theme: theme, route: 'profile', selectedId: window.__target });
      }, { theme, lang });
      await page.waitForTimeout(350);
      await shot(page, 'dev-panel-' + sfx + '.png');
      // Org-capability view
      await page.evaluate(({ theme, lang }) => {
        const WP = window.WP;
        WP.state.lang = lang;
        document.documentElement.lang = lang; document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
        WP.setState({ theme: theme, route: 'org' });
      }, { theme, lang });
      await page.waitForTimeout(250);
      await shot(page, 'org-capability-' + sfx + '.png');
    }
  }
  await browser.close();
  if (errors.length) { console.log('SHOT FAIL — JS errors:\n' + errors.join('\n')); process.exit(1); }
  console.log('SHOT OK — no JS pageerrors');
})();
