/* ============================================================
 * Tempo — Promotion-Development Readiness + Org Capability Intelligence
 *          (Intelligence Layer P6, core · ENGINE ONLY)
 * SPEC: docs/SPEC-readiness.md · GATE: ai-os/00-governance/INTELLIGENCE-ETHICS.md
 * ------------------------------------------------------------
 * The MOST ethics-sensitive engine in the roadmap — it touches careers. It reads
 * the append-only evidence store (WP.events) + completed evaluations to help a
 * leader DEVELOP and GROW people FROM EVIDENCE. It SUPPORTS a human's judgement;
 * it NEVER ranks, rates, scores, or decides a promotion.
 *
 * Two read-only, pure-ish outputs:
 *   developmentProfile(personId, opts) -> an evidence-based DEVELOPMENT bundle for
 *     ONE person: { strengths[], growthAreas[], evidenceCoverage, gaps, enoughEvidence }.
 *     Framed as growth/support, every item cites real events. NO readiness score, NO
 *     promote/hold verdict, NO percentage, NO rank. Sparse → "Not enough evidence yet".
 *   orgCapability(opts) -> an AGGREGATED + ANONYMIZED org planning view: capability
 *     distribution + skill-gap areas. HARD k-anonymity: any cohort/cell smaller than
 *     CONFIG.minCohort is suppressed ("too few to show"). No per-person rows, no names.
 *
 * Hard guardrails (enforced here + asserted in test/verify-readiness.js):
 *  - Support, not surveil — development evidence + org planning aggregates only;
 *    never a person-score/rank/profile, never presence/behaviour. (Ethics #1)
 *  - Evidence-first — every item cites sourced events; "Not enough evidence yet" and
 *    "too few to show" are valid, first-class outputs. (Ethics #2)
 *  - Human decides — output INFORMS; NO promote/hold/rank/recommendation field. The
 *    evaluation's own promotion-recommendation text is deliberately NOT surfaced. (#3)
 *  - Transparent — every figure is traceable to its source events. (Ethics #4)
 *  - Dignity — growth framed constructively, never naming-and-shaming; k-anonymity
 *    protects individuals inside every aggregate. (Ethics #5)
 *  - Access-gated — orgCapability is director/admin (canManage); per-person
 *    developmentProfile also requires canSeeSensitive (self/manager/director).
 *    Never peer-visible. (Ethics #6)
 *
 * NO DOM, NO network. The readiness/org views surface AFTER B2's V3 reskin.
 * ========================================================== */
(function (WP) {
  'use strict';

  var CONFIG = {
    minEvidence: 3,      // fewer than this many SOURCED signals → "not enough evidence yet"
    minCohort: 5,        // k-anonymity: suppress any non-empty cell smaller than this
    deliveryStrength: 3, // delivery items needed to evidence "sustained delivery"
    strongBand: 4.0,     // overall >= this → "strong" capability band (org aggregate only)
    proficientBand: 3.0, // overall >= this → "proficient"; below → "developing"
    groupGapBand: 2.5    // a competency GROUP mean <= this in an eval = an evidenced gap
  };

  // Competency groups (mirrors the evaluation model) — used ONLY for org-level,
  // anonymized skill-gap aggregation. Never to score an individual here.
  var GROUPS = ['conduct', 'behavior', 'results', 'capability'];

  function r1(x) { return Math.round(x * 10) / 10; }

  /* A citable reference for one evidence event — never invent one; drop sourceless. */
  function refOf(e) {
    if (!e || !e.source) return null; // anti-fabrication boundary (Ethics #2)
    return {
      id: e.id || null, ts: e.ts || null, category: e.category || null,
      source: e.source, confidence: e.confidence || 'observed',
      refs: (e.evidenceRefs || []).slice(), text: e.description || ''
    };
  }
  // Cite a completed evaluation as ONE evidence source (textual notes only — never
  // its numeric scores, which would re-expose a rating). Returns null if not completed.
  function evalRef(rec) {
    if (!rec || rec.status !== 'Completed') return null;
    return { id: null, ts: null, category: 'evaluation', source: 'Evaluation · ' + (rec.period || 'review'),
             confidence: 'recorded', refs: [], text: 'Completed evaluation on record' };
  }

  /* ---- DEVELOPMENT PROFILE (one person) ------------------------------------
   * PURE given (events, evalRec). Evidence-based development bundle. Growth-framed.
   * NO score / rank / verdict / percentage / readiness field anywhere. */
  function buildProfile(events, evalRec, opts) {
    opts = opts || {};
    var cited = (events || []).map(refOf).filter(Boolean); // drops sourceless = no fabrication
    var er = evalRef(evalRec);
    var totalSignals = cited.length + (er ? 1 : 0);

    // Not enough evidence is a first-class, honest result — we do NOT fabricate growth.
    if (totalSignals < CONFIG.minEvidence) {
      return {
        enoughEvidence: false,
        note: 'Not enough evidence yet',
        strengths: [], growthAreas: [],
        evidenceCoverage: { byCategory: {}, byQuarter: {}, sourcedCount: cited.length },
        gaps: ['Not enough on record to describe development yet'],
        subjectId: opts.subjectId || null
      };
    }

    var byCat = {};
    cited.forEach(function (c) { (byCat[c.category] = byCat[c.category] || []).push(c); });

    // --- strengths: evidenced positives, framed as what to build ON -----------
    var strengths = [];
    var recognition = byCat.recognition || [];
    if (recognition.length) {
      strengths.push({ area: 'recognition', text: 'Recognition on record (' + recognition.length + ')',
        evidence: recognition.slice() });
    }
    var delivery = byCat.delivery || [];
    if (delivery.length >= CONFIG.deliveryStrength) {
      strengths.push({ area: 'delivery', text: 'Sustained delivery: ' + delivery.length + ' completed item(s)',
        evidence: delivery.slice() });
    }
    var plan = byCat.plan || [];
    if (plan.length) {
      strengths.push({ area: 'planning', text: 'Forward planning evidenced (' + plan.length + ')',
        evidence: plan.slice() });
    }
    // Qualitative strengths from a COMPLETED review (text only, cited — no scores).
    if (er && evalRec.feedback && evalRec.feedback.strengths) {
      strengths.push({ area: 'review-note', text: 'Noted in last review: ' + evalRec.feedback.strengths,
        evidence: [er] });
    }

    // --- growthAreas: evidenced opportunities, framed as SUPPORT not judgement --
    var growthAreas = [];
    var risk = byCat.risk || [];
    if (risk.length) {
      growthAreas.push({ area: 'support', text: 'Open blockers worth supporting (' + risk.length + ')',
        evidence: risk.slice() });
    }
    var wellbeing = byCat.wellbeing || [];
    if (wellbeing.length) {
      growthAreas.push({ area: 'wellbeing', text: 'Wellbeing signals to support (' + wellbeing.length + ')',
        evidence: wellbeing.slice() });
    }
    if (er && evalRec.feedback && evalRec.feedback.growth) {
      growthAreas.push({ area: 'review-note', text: 'Growth area from last review: ' + evalRec.feedback.growth,
        evidence: [er] });
    }

    // --- evidenceCoverage: transparent COUNTS of evidence (not a person-score) --
    var byCategory = {}; Object.keys(byCat).forEach(function (k) { byCategory[k] = byCat[k].length; });
    var byQuarter = {};
    if (WP.events && WP.events.quarterOf) {
      cited.forEach(function (c) { var q = WP.events.quarterOf(c.ts); if (q) byQuarter[q] = (byQuarter[q] || 0) + 1; });
    }

    // --- gaps: honest "what's NOT on record" — absence, never an inferred fault --
    var gaps = [];
    var meaningful = ['delivery', 'recognition', 'plan', 'wellbeing'];
    meaningful.forEach(function (cat) { if (!byCat[cat] || !byCat[cat].length) gaps.push('No ' + cat + ' evidence on record'); });
    if (!er) gaps.push('No completed evaluation on record');

    return {
      enoughEvidence: true,
      strengths: strengths,
      growthAreas: growthAreas,
      evidenceCoverage: { byCategory: byCategory, byQuarter: byQuarter, sourcedCount: cited.length },
      gaps: gaps,
      subjectId: opts.subjectId || null
      // NOTE: intentionally NO readiness score, NO promote/hold verdict, NO percentage, NO rank.
    };
  }

  function deniedProfile(personId, reason) {
    return { enoughEvidence: false, denied: true, note: reason || 'Access not permitted',
             strengths: [], growthAreas: [], evidenceCoverage: { byCategory: {}, byQuarter: {}, sourcedCount: 0 },
             gaps: [], subjectId: personId };
  }

  /* Store-backed + access-gated. Per-person → requires canSeeSensitive (self /
   * direct manager / director-HR). Never peer-visible (Ethics #6). */
  function developmentProfile(personId, opts) {
    opts = opts || {};
    if (opts.viewer && !(WP.access && WP.access.canSeeSensitive && WP.access.canSeeSensitive(opts.viewer, personId))) {
      return Promise.resolve(deniedProfile(personId));
    }
    var evRec = (WP.data && WP.data.EVALUATIONS) ? WP.data.EVALUATIONS[personId] : null;
    var q = (WP.events && WP.events.query) ? WP.events.query(personId, {}, opts.refDate) : Promise.resolve([]);
    return Promise.resolve(q).then(function (events) {
      var o = {}; o.subjectId = personId; for (var k in opts) o[k] = opts[k]; o.subjectId = personId;
      return buildProfile(events, evRec, o);
    });
  }

  /* ---- ORG CAPABILITY (aggregated + anonymized) ----------------------------
   * k-ANONYMITY: every non-empty cell smaller than minCohort is suppressed. Counts
   * of 0 reveal no individual and are reported as 0; counts 1..minCohort-1 are hidden. */
  function kCell(count, evidenceCount) {
    if (count > 0 && count < CONFIG.minCohort) {
      return { suppressed: true, note: 'too few to show' };
    }
    return { count: count, of: evidenceCount };
  }

  // group mean for one eval's scores (only over criteria present)
  function groupMean(scores, criteria, group) {
    var sum = 0, n = 0;
    criteria.forEach(function (c) {
      if (c.group === group && typeof scores[c.id] === 'number') { sum += scores[c.id]; n++; }
    });
    return n ? sum / n : null;
  }

  function buildOrgCapability(records, criteria, overallOf, opts) {
    opts = opts || {};
    var completed = (records || []).filter(function (r) { return r && r.status === 'Completed' && r.scores; });
    var N = completed.length;

    // Whole-org guard: if the entire evidenced cohort is below k, show nothing
    // identifiable — honest "too few to show" rather than a re-identifiable view.
    if (N < CONFIG.minCohort) {
      return { enoughData: false, note: 'too few to show', cohortSize: N,
               capabilityDistribution: null, skillGapAreas: null };
    }

    // capability distribution — bands by overall /5, each band a k-anonymized cell.
    var bands = { developing: 0, proficient: 0, strong: 0 };
    completed.forEach(function (r) {
      var o = overallOf(r);
      if (typeof o !== 'number') return;
      if (o >= CONFIG.strongBand) bands.strong++;
      else if (o >= CONFIG.proficientBand) bands.proficient++;
      else bands.developing++;
    });
    var capabilityDistribution = {};
    Object.keys(bands).forEach(function (b) { capabilityDistribution[b] = kCell(bands[b], N); });

    // skill-gap areas — how many evals show an evidenced gap (group mean <= band) per
    // competency GROUP. Aggregate counts only; each cell k-anonymized. Describes the
    // AREA the org should invest in, never a person.
    var skillGapAreas = {};
    GROUPS.forEach(function (g) {
      var gapCount = 0;
      completed.forEach(function (r) { var m = groupMean(r.scores, criteria, g); if (m !== null && m <= CONFIG.groupGapBand) gapCount++; });
      skillGapAreas[g] = kCell(gapCount, N);
    });

    return {
      enoughData: true,
      cohortSize: N,                 // already >= minCohort, safe to report
      capabilityDistribution: capabilityDistribution,
      skillGapAreas: skillGapAreas
      // NOTE: NO per-person rows, NO names, NO id anywhere. Aggregates only.
    };
  }

  function deniedOrg(reason) {
    return { enoughData: false, denied: true, note: reason || 'Access not permitted',
             capabilityDistribution: null, skillGapAreas: null };
  }

  /* Store-backed + access-gated: org capability is director/admin only (canManage). */
  function orgCapability(opts) {
    opts = opts || {};
    if (opts.viewer && !(WP.access && WP.access.canManage && WP.access.canManage(opts.viewer))) {
      return deniedOrg();
    }
    var EV = (WP.data && WP.data.EVALUATIONS) || {};
    var records = opts.evaluations || Object.keys(EV).map(function (k) { return EV[k]; });
    var criteria = opts.criteria || (WP.data && WP.data.EVAL_CRITERIA) || [];
    var overallOf = opts.overall || (WP.evaluation && WP.evaluation.overall) || function () { return null; };
    return buildOrgCapability(records, criteria, overallOf, opts);
  }

  WP.readiness = {
    CONFIG: CONFIG,
    GROUPS: GROUPS,
    buildProfile: buildProfile,             // pure: (events, evalRec) -> dev bundle
    developmentProfile: developmentProfile, // store-backed + access-gated (async)
    buildOrgCapability: buildOrgCapability, // pure: records -> anonymized aggregate
    orgCapability: orgCapability,           // store-backed + access-gated
    _refOf: refOf,
    _kCell: kCell
  };
})(window.WP = window.WP || {});
