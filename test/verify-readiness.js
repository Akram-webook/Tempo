/* Promotion-Development Readiness + Org Capability (Intelligence Layer P6).
 * Gate: ai-os/00-governance/INTELLIGENCE-ETHICS.md — this is the most ethics-
 * sensitive engine (it touches careers), so EVERY guardrail is asserted here.
 *
 * Proves the 6-point Intelligence-Ethics gate:
 *  1 Support-not-surveil  — output is development evidence + anonymized org planning;
 *                           NO person-score/rank/verdict field anywhere.
 *  2 Evidence-first       — every item cites events; sparse → "not enough evidence",
 *                           sub-cohort → "too few to show" (both first-class).
 *  3 Human-decides        — NO promote/hold/rank/recommendation that acts.
 *  4 Transparent          — items are traceable to source events.
 *  5 Dignity              — growth framed constructively; k-anonymity protects people.
 *  6 Access-gated         — per-person needs canSeeSensitive; org needs canManage;
 *                           never peer-visible.
 * Backend mocked (no network). */
const fs = require('fs'), path = require('path');
const { JSDOM } = require('jsdom');
const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const srcs = [...html.matchAll(/src="([^"]+\.js)"/g)].map(m => m[1]);
const dom = new JSDOM('<!doctype html><html><body><div id="view"></div></body></html>', { url: 'https://localhost/', runScripts: 'outside-only' });
const { window } = dom;
window.HTMLElement.prototype.scrollIntoView = function () {};
window.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
const errors = [];
for (const s of srcs) { try { new window.Function(fs.readFileSync(path.join(root, s), 'utf8')).call(window); } catch (e) { errors.push('[load ' + s + '] ' + e.message); } }
const WP = window.WP;
if (WP) WP.render = function () {};
function assert(c, m) { if (!c) errors.push('[assert] ' + m); }

// Recursive scan: no banned KEY may appear anywhere in the output object. These are
// the fields that would turn a development aid into a person-rating/verdict.
const BANNED = ['score', 'rank', 'ranking', 'rating', 'verdict', 'grade', 'percentage',
  'percentile', 'readiness', 'recommendation', 'promote', 'promotion', 'hold', 'overall'];
function scanNoBannedKeys(obj, where) {
  if (!obj || typeof obj !== 'object') return;
  Object.keys(obj).forEach(function (k) {
    if (BANNED.indexOf(k.toLowerCase()) !== -1) errors.push('[banned-key] "' + k + '" found in ' + where);
    scanNoBannedKeys(obj[k], where + '.' + k);
  });
}

(async () => {
  try {
    assert(WP.readiness && WP.readiness.developmentProfile && WP.readiness.orgCapability, 'WP.readiness API present');

    // ============ DEVELOPMENT PROFILE (one person) =========================
    const ev = (cat, i) => ({ id: cat + i, ts: '2026-05-0' + (i + 1) + 'T10:00:00Z', category: cat,
      source: 'evidence-store', confidence: 'observed', description: cat + ' item ' + i });
    const richEvents = () => [ev('delivery', 1), ev('delivery', 2), ev('delivery', 3),
      ev('recognition', 1), ev('plan', 1), ev('risk', 1)];

    const evalRec = { status: 'Completed', period: '2025 Mid-Year',
      feedback: { strengths: 'Calm under pressure.', growth: 'Delegate more.',
                  recommendations: 'Promotion-track to Senior Manager.', general: 'Successor candidate.' },
      scores: {} };

    const prof = WP.readiness.buildProfile(richEvents(), evalRec, { subjectId: 'p_test' });

    // (3) Human decides — NO score/rank/verdict/promote field ANYWHERE
    scanNoBannedKeys(prof, 'developmentProfile');
    // and the eval's own PROMOTION recommendation text is deliberately NOT surfaced
    assert(JSON.stringify(prof).indexOf('Promotion-track') === -1, 'eval promotion-recommendation text is NOT surfaced (human decides)');
    assert(JSON.stringify(prof).indexOf('Successor candidate') === -1, 'eval verdict/general text is NOT surfaced');

    // (1) Support — strengths + growthAreas, framed as development/support
    assert(prof.enoughEvidence === true, 'enough evidence → a profile is built');
    assert(Array.isArray(prof.strengths) && prof.strengths.length >= 2, 'strengths are listed');
    assert(Array.isArray(prof.growthAreas) && prof.growthAreas.length >= 1, 'growth areas are listed (as support)');

    // (4) Transparent / (2) Evidence-first — every item cites real events
    const allItems = prof.strengths.concat(prof.growthAreas);
    assert(allItems.every(it => Array.isArray(it.evidence) && it.evidence.length > 0), 'every strength/growth item cites evidence');
    assert(allItems.every(it => it.evidence.every(r => r && r.source)), 'every cited evidence ref carries a source (no fabrication)');

    // evidenceCoverage is transparent COUNTS (not a person-score)
    assert(prof.evidenceCoverage && prof.evidenceCoverage.byCategory.delivery === 3, 'evidenceCoverage counts by category');
    assert(prof.evidenceCoverage.byQuarter && Object.keys(prof.evidenceCoverage.byQuarter).length >= 1, 'evidenceCoverage counts by quarter');

    // gaps = honest "what's not on record" (absence, not inferred fault)
    assert(Array.isArray(prof.gaps) && prof.gaps.some(g => /No wellbeing evidence/.test(g)), 'gaps name what is missing, honestly');

    // (2) sparse → "Not enough evidence yet" first-class
    const sparse = WP.readiness.buildProfile([ev('delivery', 1)], null, { subjectId: 'p_x' });
    assert(sparse.enoughEvidence === false && /Not enough evidence/.test(sparse.note), 'sparse → not enough evidence yet (first-class)');
    assert(sparse.strengths.length === 0 && sparse.growthAreas.length === 0, 'sparse profile fabricates nothing');

    // (6) Access gate — peer DENIED, manager/self/director allowed.
    const specs = WP.data.PEOPLE.filter(p => p.level === 'spec' && p.managerId && !p.tbc);
    const target = specs[0];
    const mgr = WP.access.byId(target.managerId);
    // a peer who is NOT self / direct-manager / director of the target
    const peer = specs.find(p => p.id !== target.id && p.id !== target.managerId &&
      WP.access.relationshipTo(p, target.id) === 'none');
    const director = WP.data.PEOPLE.find(p => p.level === 'director');
    assert(peer, 'test fixture has a true peer (non-manager, non-director) of the target');

    const deniedRes = await WP.readiness.developmentProfile(target.id, { viewer: peer });
    assert(deniedRes.denied === true && deniedRes.enoughEvidence === false, 'a peer cannot see another person’s development profile (denied)');
    scanNoBannedKeys(deniedRes, 'deniedProfile');

    const mgrRes = await WP.readiness.developmentProfile(target.id, { viewer: mgr, refDate: '2026-06-27' });
    assert(!mgrRes.denied, 'the direct manager CAN see the development profile');
    const dirRes = await WP.readiness.developmentProfile(target.id, { viewer: director, refDate: '2026-06-27' });
    assert(!dirRes.denied, 'a director/HR CAN see the development profile');
    scanNoBannedKeys(mgrRes, 'mgrProfile');

    // ============ ORG CAPABILITY (aggregated + anonymized) =================
    const CRIT = WP.data.EVAL_CRITERIA;
    const capIds = CRIT.filter(c => c.group === 'capability').map(c => c.id);
    function scores(lowGroup) {
      const s = {};
      CRIT.forEach(c => { s[c.id] = (lowGroup === 'all' || c.group === lowGroup) ? 2 : 5; });
      return s;
    }
    // 5 evals low ONLY in 'capability' (still strong overall) + 1 low-everywhere.
    const records = [];
    for (let i = 0; i < 5; i++) records.push({ status: 'Completed', period: 'Q', scores: scores('capability') });
    records.push({ status: 'Completed', period: 'Q', scores: scores('all') });

    const org = WP.readiness.buildOrgCapability(records, CRIT, WP.evaluation.overall, {});
    scanNoBannedKeys(org, 'orgCapability');

    assert(org.enoughData === true && org.cohortSize === 6, 'org cohort >= minCohort → reportable');
    // capability distribution: 5 strong (shown) — developing cell (1) SUPPRESSED
    assert(org.capabilityDistribution.strong.count === 5, 'a band cell at/above minCohort shows its count');
    assert(org.capabilityDistribution.developing.suppressed === true && /too few/.test(org.capabilityDistribution.developing.note),
      'a NON-EMPTY band cell below minCohort is suppressed ("too few to show") — k-anonymity');
    assert(org.capabilityDistribution.proficient.count === 0, 'an empty cell (0) is reported as 0 — it reveals no individual');

    // skill gaps: 'capability' gap count = 6 (shown) — other groups (1) SUPPRESSED
    assert(org.skillGapAreas.capability.count === 6, 'a skill-gap area at/above minCohort shows its count');
    assert(['behavior', 'results', 'conduct'].every(g => org.skillGapAreas[g].suppressed === true || org.skillGapAreas[g].count === 0),
      'skill-gap cells below minCohort are suppressed (k-anonymity), empties stay 0');

    // (1)+(5) de-identification — NO person id / name / evaluatorId leaks in the aggregate
    const orgStr = JSON.stringify(org);
    assert(orgStr.indexOf('p_') === -1, 'no person id leaks into the org aggregate');
    assert(orgStr.indexOf('evaluatorId') === -1, 'no evaluatorId leaks into the org aggregate');
    assert(!WP.data.PEOPLE.some(p => orgStr.indexOf(p.name) !== -1), 'no person NAME leaks into the org aggregate');
    assert(orgStr.indexOf('"count":1') === -1 && orgStr.indexOf('"count":2') === -1 && orgStr.indexOf('"count":3') === -1 && orgStr.indexOf('"count":4') === -1,
      'no non-empty cell below minCohort (1–4) is ever exposed as a raw count');

    // whole-org below k → "too few to show" (real data has < 5 completed evals)
    const small = WP.readiness.buildOrgCapability(records.slice(0, 3), CRIT, WP.evaluation.overall, {});
    assert(small.enoughData === false && /too few to show/.test(small.note), 'a whole cohort below minCohort → too few to show');
    assert(small.capabilityDistribution === null && small.skillGapAreas === null, 'sub-cohort exposes no cells at all');

    // (6) org access gate — a specialist is DENIED, a director is allowed
    const spec = WP.data.PEOPLE.find(p => p.level === 'spec' && !p.tbc);
    const denyOrg = WP.readiness.orgCapability({ viewer: spec });
    assert(denyOrg.denied === true, 'org capability is denied to a non-manager (specialist)');
    const okOrg = WP.readiness.orgCapability({ viewer: director, evaluations: records });
    assert(!okOrg.denied && okOrg.enoughData === true, 'a director can see org capability');

  } catch (e) { errors.push('[throw] ' + e.message + '\n' + e.stack); }

  if (errors.length) { console.log('FAIL verify-readiness\n' + errors.join('\n')); process.exit(1); }
  console.log('PASS verify-readiness — development support + anonymized org capability; all 6 ethics gates + k-anonymity enforced');
})();
