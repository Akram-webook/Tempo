/* ============================================================
 * END-TO-END INTELLIGENCE-ETHICS REGRESSION HARNESS
 * Gate: ai-os/00-governance/INTELLIGENCE-ETHICS.md  ·  Spec: docs/intelligence-layer.md
 * ------------------------------------------------------------
 * Each engine (P1 timeline · P2 evalPrep · P3 evalIntel · P5 decisionMemory ·
 * P6 readiness) asserts its own ethics in isolation. The real risk is a LEAK ACROSS
 * the combined surface. This harness seeds ONE deterministic synthetic org, runs the
 * WHOLE chain, and asserts the 6 invariants hold on EVERY output — by recursive
 * key+value scan, never by eyeballing. If a future change leaks a verdict/score/
 * identity anywhere across the layer, CI fails here.
 *
 * Invariants:
 *  I1 No score/rank/verdict/promote-hold/percentage/per-person-profile in any
 *     leadership/aggregate or suggestion output. (evals may CITE an existing human
 *     rating in the gated evaluator view — never INVENT one.)
 *  I2 suggestedRange is a RANGE [low<high], never a lone /5 number.
 *  I3 k-anonymity end-to-end: the <5 cohort is suppressed in orgCapability AND is not
 *     reconstructable by cross-referencing decisionMemory / any aggregate.
 *  I4 evidence-first: sparse → "not enough evidence" / "too few to show", first-class.
 *  I5 de-identified: decisionMemory refs stay {type,at,focus,idx}; no per-person rows.
 *  I6 access-gated: peer denied on developmentProfile; org report is canManage-only.
 * ========================================================== */
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

// A NEW person-rating/verdict must NEVER appear, in ANY output.
const HARD_BANNED = ['rank', 'ranking', 'verdict', 'grade', 'percentage', 'percentile',
  'readiness', 'promote', 'promotion', 'hold', 'profilescore', 'personscore'];
// Aggregate / suggestion outputs ALSO carry no score/overall/rating at all.
const AGG_BANNED = HARD_BANNED.concat(['score', 'overall', 'rating']);
function scanKeys(obj, banned, where) {
  if (!obj || typeof obj !== 'object') return;
  Object.keys(obj).forEach(function (k) {
    if (banned.indexOf(k.toLowerCase()) !== -1) errors.push('[banned-key:' + k + '] in ' + where);
    scanKeys(obj[k], banned, where + '.' + k);
  });
}

(async () => {
  const F = require('./fixtures/intel-org.js')(WP);
  await F.ready;

  try {
    // ===================== RUN THE FULL CHAIN ============================
    const refDate = '2026-06-27';
    // P1 evidence timeline (store-backed)
    const timeline = await WP.events.query(F.richId, {}, refDate);
    // P2 evalPrep
    const prepRich = await WP.evalPrep.prepare(F.richId, {}, refDate);
    const prepSparse = await WP.evalPrep.prepare(F.sparseId, {}, refDate);
    // P3 evalIntel
    const rangeRich = await WP.evalIntel.suggestedRange(F.richId, null, { viewer: F.mgr, refDate });
    const rangeSparse = await WP.evalIntel.suggestedRange(F.sparseId, null, { viewer: F.mgr, refDate });
    const consistency = await WP.evalIntel.consistencyCheck(F.mgr.id, null, { refDate });
    // P5 decisionMemory (store-backed; activityLog seeded with sx_ targets)
    const weekly = WP.decisionMemory.weeklyReport(F.reportWindow, { viewer: F.dir });
    // P6 readiness
    const devRich = await WP.readiness.developmentProfile(F.richId, { viewer: F.mgr, refDate });
    const devSparse = await WP.readiness.developmentProfile(F.sparseId, { viewer: F.mgr, refDate });
    // deterministic cohort for the cell asserts: ONLY the synthetic completed evals
    const synthEvals = F.strongIds.concat(F.developingIds).map(id => WP.data.EVALUATIONS[id]);
    const orgSynthetic = WP.readiness.orgCapability({ viewer: F.dir, evaluations: synthEvals });
    const orgRealStore = WP.readiness.orgCapability({ viewer: F.dir }); // whole store, for leak scan

    assert(timeline.length > 0, 'chain runs: rich subject has a timeline');

    // ===================== I1 — no invented score/rank/verdict ==========
    scanKeys(prepRich, AGG_BANNED, 'evalPrep(rich)');
    scanKeys(prepSparse, AGG_BANNED, 'evalPrep(sparse)');
    scanKeys(rangeRich, AGG_BANNED, 'suggestedRange(rich)');
    scanKeys(rangeSparse, AGG_BANNED, 'suggestedRange(sparse)');
    scanKeys(weekly, AGG_BANNED, 'weeklyReport');
    scanKeys(devRich, AGG_BANNED, 'developmentProfile(rich)');
    scanKeys(devSparse, AGG_BANNED, 'developmentProfile(sparse)');
    scanKeys(orgSynthetic, AGG_BANNED, 'orgCapability(synthetic)');
    scanKeys(orgRealStore, AGG_BANNED, 'orgCapability(store)');
    scanKeys(timeline, AGG_BANNED, 'timeline');
    // consistencyCheck may CITE the evaluator's existing ratings, but must not RANK/verdict…
    scanKeys(consistency, HARD_BANNED, 'consistencyCheck');
    // …and the ratings it cites must be REAL (not fabricated): each equals a seeded overall.
    const seededOveralls = synthEvals.map(r => WP.evaluation.overall(r));
    (consistency.warnings || []).forEach(function (w) {
      (w.evidence || []).forEach(function (e) {
        if (typeof e.overall === 'number') assert(seededOveralls.indexOf(e.overall) !== -1, 'consistencyCheck cites a real rating, never an invented one');
      });
    });

    // ===================== I2 — range, never a lone number ==============
    assert(rangeRich.enoughEvidence === true && Array.isArray(rangeRich.range) && rangeRich.range.length === 2, 'suggestedRange returns a 2-element range');
    assert(rangeRich.range[0] < rangeRich.range[1], 'range is a true span (low < high), never collapsed to one number');
    assert(typeof rangeRich.suggestion === 'undefined' && typeof rangeRich.value === 'undefined' && typeof rangeRich.point === 'undefined',
      'no lone single-value suggestion field is emitted alongside the range');

    // ===================== I4 — evidence-first (sparse first-class) =====
    assert(rangeSparse.enoughEvidence === false && rangeSparse.range === null, 'sparse subject → suggestedRange "not enough evidence" (no fabricated range)');
    assert(prepSparse.enough === false, 'sparse subject → evalPrep "not enough" first-class');
    assert(devSparse.enoughEvidence === false && /Not enough evidence/.test(devSparse.note), 'sparse subject → developmentProfile "not enough evidence yet"');
    // pure-engine confirmation (deterministic): one event is never enough
    assert(WP.evalIntel.assess([{ source: 's', category: 'delivery', id: 'x' }]).enoughEvidence === false, 'assess([1]) is not enough (pure)');
    assert(WP.evalPrep.summarize([{ source: 's', category: 'delivery' }]).enough === false, 'summarize([1]) is not enough (pure)');
    assert(WP.readiness.buildProfile([{ source: 's', category: 'delivery', id: 'x' }], null, {}).enoughEvidence === false, 'buildProfile([1]) is not enough (pure)');

    // ===================== I3 — k-anonymity, cell + cross-engine ========
    assert(orgSynthetic.enoughData === true && orgSynthetic.cohortSize === 8, 'org cohort reportable (8)');
    assert(orgSynthetic.capabilityDistribution.strong.count === 5, 'the >=5 cohort (strong) shows its count');
    assert(orgSynthetic.capabilityDistribution.developing.suppressed === true, 'the <5 cohort (developing=3) is SUPPRESSED ("too few to show")');
    // whole-cohort-below-k path
    const orgSmall = WP.readiness.buildOrgCapability(synthEvals.slice(0, 3), WP.data.EVAL_CRITERIA, WP.evaluation.overall, {});
    assert(orgSmall.enoughData === false && /too few to show/.test(orgSmall.note), 'a whole cohort below minCohort → too few to show');

    // CROSS-ENGINE RECONSTRUCTION: an observer holding ONLY the leadership aggregates
    // (orgCapability + weeklyReport) must not be able to (a) identify, or (b) count,
    // the suppressed developing cohort — even by combining the two.
    const combinedAggregates = JSON.stringify({ org: orgSynthetic, orgStore: orgRealStore, weekly: weekly });
    F.developingIds.forEach(function (id) { assert(combinedAggregates.indexOf(id) === -1, 'suppressed-cohort member ' + id + ' is not identifiable across the combined aggregates'); });
    F.allSyntheticIds.forEach(function (id) { assert(combinedAggregates.indexOf(id) === -1, 'no synthetic person id (' + id + ') leaks into any aggregate'); });
    assert(!WP.data.PEOPLE.some(p => /^sx_/.test(p.id) && p.name && combinedAggregates.indexOf(p.name) !== -1), 'no synthetic name leaks into the aggregates');
    // The suppressed cohort SIZE (people-in-a-band) is never exposed as a raw cell in
    // orgCapability — so it can't be reconstructed. (Scoped to orgCapability: decisionMemory's
    // de-identified decision-type tallies are operational counts, not people buckets.)
    const orgCells = JSON.stringify({ a: orgSynthetic, b: orgRealStore });
    [1, 2, 3, 4].forEach(function (n) { assert(orgCells.indexOf('"count":' + n) === -1, 'no sub-minCohort capability cell (count ' + n + ') is exposed'); });

    // ===================== I5 — de-identified decision refs =============
    assert(weekly.enoughData === true, 'weekly report has enough data');
    const refOk = (r) => r && Object.keys(r).every(k => ['type', 'at', 'focus', 'idx'].indexOf(k) !== -1);
    const allRefs = [].concat(
      weekly.evidence || [],
      ...Object.keys(weekly.decisionCounts || {}).map(t => weekly.decisionCounts[t].evidence || []),
      ...(weekly.topFocusAreas || []).map(f => f.evidence || []),
      (weekly.aiAcceptanceRate && weekly.aiAcceptanceRate.evidence) || [],
      ...(weekly.shifts || []).map(s => s.evidence || [])
    );
    assert(allRefs.length > 0 && allRefs.every(refOk), 'every decisionMemory ref stays {type,at,focus,idx} — no target/by/reason');
    assert(JSON.stringify(weekly).indexOf('sx_') === -1, 'weeklyReport carries no per-person id/row (de-identified)');

    // ===================== I6 — access gates reject =====================
    assert((await WP.readiness.developmentProfile(F.richId, { viewer: F.peer })).denied === true, 'peer is DENIED a development profile');
    assert(WP.readiness.orgCapability({ viewer: F.peer }).denied === true, 'a non-manager is DENIED org capability');
    assert(WP.decisionMemory.weeklyReport(F.reportWindow, { viewer: F.peer }).denied === true, 'a non-manager is DENIED the weekly report');
    assert(!orgSynthetic.denied && !weekly.denied, 'a director is allowed the leadership aggregates');

    // ===================== regression: forward-feed a range =============
    // If a downstream consumer attaches suggestedRange onto a decision event, the
    // chain must NOT re-emit it as a numeric score, and the range must not propagate.
    const tainted = [{ type: 'evaluation', by: 'sx_mgr', target: 'sx_m1', at: '2026-05-13T09:00:00Z',
      suggestedRange: rangeRich.range, aiAccepted: true }].concat(WP.activityLog);
    const repTainted = WP.decisionMemory.aggregate(tainted, F.reportWindow, {});
    scanKeys(repTainted, AGG_BANNED, 'weeklyReport(taintedWithRange)');
    assert(JSON.stringify(repTainted).indexOf('suggestedRange') === -1, 'a forwarded suggestedRange is dropped, never propagated downstream');

  } catch (e) { errors.push('[throw] ' + e.message + '\n' + e.stack); }

  if (errors.length) { console.log('FAIL verify-intelligence-layer\n' + errors.join('\n')); process.exit(1); }
  console.log('PASS verify-intelligence-layer — 6 ethics invariants hold ACROSS the whole engine layer (no cross-engine leak)');
})();
