/* ============================================================
 * Webook Workload — Performance Evaluation (downward feedback)
 * ------------------------------------------------------------
 * Mirrors the real Webook evaluation: 16 weighted competency
 * criteria rated 1–5 (Scale) + 5 qualitative feedback questions.
 * Done by the LINE MANAGER (downward). Weighted overall → /5.
 *
 * Best-practice notes (see docs/EVALUATION-MODEL.md):
 *  - Conduct items (Punctuality, Appearance) are kept in their own
 *    lighter-weight group, not blended with capability — flagged.
 *  - Pair with a SELF-assessment; don't auto-tie the score to pay.
 * ========================================================== */
(function (WP) {
  'use strict';

  // weights sum to 100
  const EVAL_CRITERIA = [
    { id: 'punctuality', en: 'Punctuality',                     ar: 'الالتزام بالمواعيد', weight: 6,  group: 'conduct' },
    { id: 'appearance',  en: 'Appearance',                      ar: 'المظهر',             weight: 4,  group: 'conduct' },
    { id: 'culture',     en: 'Culture Fit',                     ar: 'التوافق الثقافي',    weight: 10, group: 'behavior' },
    { id: 'stress',      en: 'Stress Management',               ar: 'إدارة الضغط',        weight: 6,  group: 'behavior' },
    { id: 'excellence',  en: 'Strive for Excellence',           ar: 'السعي للتميّز',      weight: 7,  group: 'behavior' },
    { id: 'productivity',en: 'Productivity',                    ar: 'الإنتاجية',          weight: 7,  group: 'results' },
    { id: 'technical',   en: 'Technical / Operational Knowledge',ar: 'المعرفة التقنية/التشغيلية', weight: 6, group: 'capability' },
    { id: 'results',     en: 'Results Oriented',                ar: 'موجّه للنتائج',      weight: 7,  group: 'results' },
    { id: 'creativity',  en: 'Creativity & Innovation',         ar: 'الإبداع والابتكار',  weight: 7,  group: 'behavior' },
    { id: 'ownership',   en: 'Ownership & Accountability',      ar: 'الملكية والمساءلة',  weight: 7,  group: 'behavior' },
    { id: 'problem',     en: 'Problem Solving',                 ar: 'حل المشكلات',        weight: 6,  group: 'capability' },
    { id: 'resilience',  en: 'Resilience and Adaptability',     ar: 'المرونة والتكيّف',   weight: 8,  group: 'behavior' },
    { id: 'teamwork',    en: 'Teamwork',                        ar: 'العمل الجماعي',      weight: 6,  group: 'behavior' },
    { id: 'comm_w',      en: 'Communication — Written',         ar: 'التواصل الكتابي',    weight: 4,  group: 'capability' },
    { id: 'comm_v',      en: 'Communication — Verbal',          ar: 'التواصل الشفهي',     weight: 3,  group: 'capability' },
    { id: 'criticism',   en: 'Accepts Constructive Criticism',  ar: 'تقبّل النقد البنّاء', weight: 6, group: 'behavior' },
  ];

  const EVAL_QUESTIONS = [
    { key: 'achievements', en: 'Achievements',         ar: 'الإنجازات',
      promptEn: 'Notable accomplishments or exceptional contributions during this period?',
      promptAr: 'أبرز الإنجازات أو المساهمات الاستثنائية خلال هذه الفترة؟' },
    { key: 'strengths',    en: 'Strengths',            ar: 'نقاط القوة',
      promptEn: 'Key strengths, skills or attributes that positively impact their role and team?',
      promptAr: 'أهم نقاط القوة والمهارات التي تؤثر إيجاباً على دوره وفريقه؟' },
    { key: 'growth',       en: 'Growth areas',         ar: 'مجالات التطوير',
      promptEn: 'Specific areas of performance or skills that require improvement?',
      promptAr: 'المجالات المحددة في الأداء أو المهارات التي تحتاج تحسيناً؟' },
    { key: 'trainings',    en: 'Recommended trainings', ar: 'التدريبات المقترحة',
      promptEn: 'Actionable steps or training programs to enhance skills and performance?',
      promptAr: 'خطوات عملية أو برامج تدريبية لتعزيز المهارات والأداء؟' },
    { key: 'general',      en: 'General feedback',     ar: 'ملاحظات عامة',
      promptEn: 'Additional comments or insights not covered above?',
      promptAr: 'ملاحظات أو رؤى إضافية غير مغطاة أعلاه؟' },
    { key: 'recommendations', en: 'Recommendations',   ar: 'التوصيات', sensitive: true,
      promptEn: 'Actions such as promotion, monitoring, etc., based on performance and potential?',
      promptAr: 'إجراءات مثل الترقية أو المتابعة بناءً على الأداء والإمكانات؟' },
  ];

  // Mocked completed evaluations. scores keyed by criterion id (1–5).
  const EVALUATIONS = {
    p_akram: { period: '2025 Mid-Year', status: 'Completed', evaluatorId: 'p_motaa',
      scores: { punctuality:5, appearance:4, culture:5, stress:4, excellence:5, productivity:5, technical:5, results:5, creativity:4, ownership:5, problem:5, resilience:5, teamwork:5, comm_w:4, comm_v:4, criticism:4 },
      feedback: { achievements:'Ran MDLBEAST + Expo in parallel; built the workload view used by the team.',
        strengths:'Systems thinker, calm under pressure, develops his people.', growth:'Delegate more; protect his own time.',
        trainings:'Advanced stakeholder management; delegation workshop.', general:'A model operator and a successor candidate.',
        recommendations:'Promotion-track to Senior Manager within 6–9 months.' } },
    p_osama: { period: '2025 Mid-Year', status: 'Completed', evaluatorId: 'p_akram',
      scores: { punctuality:5, appearance:4, culture:4, stress:2, excellence:5, productivity:5, technical:5, results:5, creativity:4, ownership:5, problem:5, resilience:3, teamwork:5, comm_w:4, comm_v:4, criticism:4 },
      feedback: { achievements:'Delivered the festival + international summit at the same time without dropping quality.',
        strengths:'Trusted on the hardest events; excellent on-site problem solving.', growth:'Stress management and boundaries; learn to say no.',
        trainings:'Time-management / boundaries coaching; delegation basics.', general:'Over-relied on — risk of burnout if not eased.',
        recommendations:'Promotion-ready, but reduce load first and give him a junior to mentor.' } },
    p_idris: { period: '2025 Mid-Year', status: 'In progress', evaluatorId: 'p_akram',
      scores: { punctuality:4, appearance:4, culture:4, stress:3, excellence:3, productivity:2, technical:2, results:3, creativity:3, ownership:3, problem:2, resilience:3, teamwork:4, comm_w:3, comm_v:3, criticism:4 },
      feedback: { achievements:'Onboarding well; completed first signage task.', strengths:'Eager, fast learner, good attitude.',
        growth:'Everything is new — tools, reporting, process.', trainings:'Tools onboarding; shadow a senior on a Tier-1.',
        general:'New hire (joined May) — keep load light this quarter.', recommendations:'Monitor & develop; revisit next quarter.' } },
    p_talal: { period: '2025 Mid-Year', status: 'Completed', evaluatorId: 'p_abdulrahman',
      scores: { punctuality:5, appearance:4, culture:4, stress:4, excellence:4, productivity:4, technical:3, results:4, creativity:4, ownership:4, problem:4, resilience:4, teamwork:5, comm_w:3, comm_v:4, criticism:5 },
      feedback: { achievements:'Solid gala support; consistently asks for more responsibility.', strengths:'Reliable, hungry, great teammate.',
        growth:'Needs a bigger stage to prove ownership; reporting.', trainings:'Lead a Tier-2/3 solo; reporting basics.',
        general:'Underused — has never been handed a Tier-1.', recommendations:'Give him a stretch assignment before judging readiness (fairness).' } },
  };

  function overall(ev) {
    if (!ev || !ev.scores) return null;
    let sum = 0, w = 0;
    EVAL_CRITERIA.forEach(function (c) {
      const s = ev.scores[c.id];
      if (typeof s === 'number') { sum += s * c.weight; w += c.weight; }
    });
    return w ? Math.round((sum / w) * 10) / 10 : null; // /5
  }

  function currentPeriod() {
    var c = activeCycle();
    return (c && c.name) ? c.name : '2025 Mid-Year';
  }
  function ensure(personId) {
    if (!EVALUATIONS[personId]) {
      EVALUATIONS[personId] = { period: currentPeriod(), status: 'Not started', evaluatorId: null, scores: {}, feedback: {} };
    }
    return EVALUATIONS[personId];
  }

  /* ---- Evaluation cycles (HR opens them) ---- */
  const CYCLES = [
    { id: 'q1_2026',     name: 'Q1 2026',       type: 'Quarterly', start: '2026-01-01', end: '2026-03-31', due: '2026-04-07', status: 'Completed' },
    { id: 'q2_2026',     name: 'Q2 2026',       type: 'Quarterly', start: '2026-04-01', end: '2026-06-30', due: '2026-06-30', status: 'Active' },
    { id: 'q3_2026',     name: 'Q3 2026',       type: 'Quarterly', start: '2026-07-01', end: '2026-09-30', due: '2026-10-07', status: 'Upcoming' },
    { id: 'annual_2026', name: '2026 Annual',   type: 'Annual',    start: '2026-12-01', end: '2026-12-20', due: '2026-12-25', status: 'Upcoming' },
  ];
  let activeCycleId = 'q2_2026';
  function activeCycle() { return CYCLES.find(function (c) { return c.id === activeCycleId; }); }

  // Deadline state for the active cycle (drives the mandatory banner + overdue flags).
  function dueInfo() {
    const c = activeCycle();
    if (!c || !c.due) return null;
    const today = new Date().toISOString().slice(0, 10);
    const daysLeft = Math.ceil((Date.parse(c.due) - Date.parse(today)) / 86400000);
    return { cycle: c, due: c.due, daysLeft: daysLeft, overdue: daysLeft < 0 };
  }
  // What a manager MUST complete this cycle = a review for each direct report.
  function requiredFor(viewerId) {
    const reports = (WP.access && WP.access.directReports(viewerId)) || [];
    let done = 0;
    reports.forEach(function (p) { const e = EVALUATIONS[p.id]; if (e && e.status === 'Completed') done++; });
    return { total: reports.length, done: done, pending: reports.length - done, reports: reports };
  }

  /* ---- SELF-assessment (employee rates themselves) — shown beside the
   * manager's rating to surface blind spots (the fairness move). ---- */
  const SELF = {
    p_akram: { status: 'Completed', scores: { punctuality:5, appearance:4, culture:5, stress:4, excellence:5, productivity:5, technical:5, results:5, creativity:5, ownership:5, problem:5, resilience:5, teamwork:5, comm_w:5, comm_v:5, criticism:5 },
      feedback: { achievements:'Shipped the workload tool and ran two Tier-1s.', strengths:'Systems + delivery.', growth:'Delegation.', trainings:'Leadership program.', general:'', recommendations:'' } },
    p_osama: { status: 'Completed', scores: { punctuality:5, appearance:5, culture:5, stress:4, excellence:5, productivity:5, technical:5, results:5, creativity:5, ownership:5, problem:5, resilience:5, teamwork:5, comm_w:4, comm_v:4, criticism:4 },
      feedback: { achievements:'Delivered festival + summit together.', strengths:'On-site execution.', growth:'Nothing major.', trainings:'', general:'I feel I handle the pressure fine.', recommendations:'' } },
    p_idris: { status: 'In progress', scores: { punctuality:5, appearance:5, culture:4, stress:4, excellence:4, productivity:3, technical:3, results:3, creativity:4, ownership:4, problem:3, resilience:4, teamwork:5, comm_w:3, comm_v:4, criticism:4 },
      feedback: { achievements:'Learning fast.', strengths:'Attitude + speed.', growth:'Tools.', trainings:'', general:'', recommendations:'' } },
  };
  function ensureSelf(personId) {
    if (!SELF[personId]) SELF[personId] = { status: 'Not started', scores: {}, feedback: {} };
    return SELF[personId];
  }

  WP.data.CYCLES = CYCLES;
  WP.data.SELF = SELF;

  /* ---- UPWARD feedback (employee → manager) ----
   * Aggregated + anonymous. Routed UP the chain (visible to people ABOVE
   * the rated manager), never to the manager raw — so raters feel safe.
   * Behaviors, not personality. Suppressed below MIN_RATERS. */
  const MIN_RATERS = 3; // k-threshold (3–5 defensible; 5 is stricter)
  const UPWARD_CRITERIA = [
    { id: 'clarity',       en: 'Clarity & direction',  ar: 'وضوح التوجيه' },
    { id: 'support',       en: 'Support & coaching',   ar: 'الدعم والتدريب' },
    { id: 'fairness',      en: 'Fairness',             ar: 'العدالة' },
    { id: 'communication', en: 'Communication',        ar: 'التواصل' },
    { id: 'recognition',   en: 'Recognition',          ar: 'التقدير' },
    { id: 'decisions',     en: 'Decision-making',      ar: 'اتخاذ القرار' },
  ];
  const UPWARD_QUESTIONS = [
    { key: 'going_well', en: 'What is your manager doing well?', ar: 'ماذا يفعل مديرك بشكل جيد؟' },
    { key: 'improve',    en: 'What could your manager improve?', ar: 'ما الذي يمكن أن يحسّنه مديرك؟' },
  ];
  // aggregated per manager id
  const UPWARD = {
    p_akram: { n: 3, scores: { clarity:4, support:5, fairness:4, communication:4, recognition:3, decisions:4 },
      themes: ['Unblocks us quickly', 'Priorities are always clear', 'Could celebrate small wins more'] },
    p_motaa: { n: 3, scores: { clarity:5, support:4, fairness:5, communication:5, recognition:4, decisions:4 },
      themes: ['Calm and fair under pressure', 'Shares the bigger picture', 'Sometimes slow to document decisions'] },
    p_abdulrahman: { n: 2, scores: {}, themes: [] }, // below threshold → suppressed
  };
  function upwardOverall(u) {
    if (!u || !u.scores) return null;
    const v = Object.values(u.scores); if (!v.length) return null;
    return Math.round((v.reduce(function (a, b) { return a + b; }, 0) / v.length) * 10) / 10;
  }

  /* ---- COMPENSATION (most sensitive — budget authority only) ----
   * Show pay-band + compa-ratio CONTEXT, never peer-by-peer salaries. */
  const COMP = {
    p_akram:       { band: 'M3', min: 18000, mid: 24000, max: 30000, salary: 25500 },
    p_osama:       { band: 'S2', min: 12000, mid: 16000, max: 20000, salary: 15000 },
    p_motaa:       { band: 'M4', min: 26000, mid: 34000, max: 42000, salary: 33000 },
    p_idris:       { band: 'S1', min: 9000,  mid: 12000, max: 15000, salary: 10000 },
    p_talal:       { band: 'S1', min: 9000,  mid: 12000, max: 15000, salary: 11500 },
  };
  function compaRatio(c) { return c && c.mid ? Math.round((c.salary / c.mid) * 100) / 100 : null; }

  WP.data.EVAL_CRITERIA = EVAL_CRITERIA;
  WP.data.EVAL_QUESTIONS = EVAL_QUESTIONS;
  WP.data.EVALUATIONS = EVALUATIONS;
  WP.data.UPWARD_CRITERIA = UPWARD_CRITERIA;
  WP.data.UPWARD_QUESTIONS = UPWARD_QUESTIONS;
  WP.data.UPWARD = UPWARD;
  WP.data.MIN_RATERS = MIN_RATERS;
  WP.data.COMP = COMP;
  WP.evaluation = {
    overall: overall, ensure: ensure, ensureSelf: ensureSelf,
    upwardOverall: upwardOverall, compaRatio: compaRatio,
    cycles: function () { return CYCLES; },
    activeCycle: activeCycle,
    dueInfo: dueInfo,
    requiredFor: requiredFor,
    setActiveCycle: function (id) { activeCycleId = id; },
    addCycle: function (c) { CYCLES.push(c); activeCycleId = c.id; },
  };
})(window.WP = window.WP || {});
