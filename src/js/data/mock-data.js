/* ============================================================
 * Webook Workload — Mock Data  (REAL Saudi Event-Operations team)
 * ------------------------------------------------------------
 * Names, titles, hierarchy and PHOTOS are the real team from Slack,
 * structured per the manager's org chart. Workload numbers, events,
 * skills and reviews are STILL mocked for the demo.
 *
 * Structure (Saudi team):
 *   Ahmed Othman (Director)
 *   ├─ Ayman Albasha (Sr Mgr) → Batool, Shahad
 *   ├─ Motaa (Sr Mgr · Ticketing) → Akram → {Idris,Gamal,Osama};
 *   │                               Khaled → {Ibrahim};
 *   │                               Abdulrahman Maksousa → {Shamma,Talal}
 *   ├─ Ayah Nasif (Sr Mgr) → Farah, Meshal Bin Howshan, Meshal Alsmari, Rana
 *   └─ Hani Ahmed (Sr Mgr) → Mohamed Zaidan, Ahmed Faraj, Batarfi,
 *                            Omar Zarea (Cashless) → {Aljazi, Rosa, Altahini}
 * NOTE: "Farah" was listed under both Ayah and Omar Zarea — placed under
 * Ayah here; move her in Settings if she belongs to Cashless. "أمين" under
 * Ayah was unclear and left out.
 * ========================================================== */
(function (WP) {
  'use strict';

  const TIERS = {
    1: { id: 1, key: 'mega',     weight: 50, labelEn: 'Tier 1 · Mega',     labelAr: 'الفئة ١ · ضخم' },
    2: { id: 2, key: 'medium',   weight: 25, labelEn: 'Tier 2 · Medium',   labelAr: 'الفئة ٢ · متوسط' },
    3: { id: 3, key: 'standard', weight: 10, labelEn: 'Tier 3 · Standard', labelAr: 'الفئة ٣ · قياسي' },
  };

  const STATES = [
    { key: 'available',  min: 0,  max: 40,  labelEn: 'Available',     labelAr: 'متاح',          token: '--state-available' },
    { key: 'balanced',   min: 41, max: 75,  labelEn: 'Balanced',      labelAr: 'متوازن',        token: '--state-balanced' },
    { key: 'near',       min: 76, max: 95,  labelEn: 'Near Capacity', labelAr: 'قارب الامتلاء', token: '--state-near' },
    { key: 'overloaded', min: 96, max: 999, labelEn: 'Overloaded',    labelAr: 'محمّل زيادة',    token: '--state-overloaded' },
  ];

  const HEALTHY_STATE = 'balanced';
  const LEVELS = { director: { rank: 0 }, sr_manager: { rank: 1 }, manager: { rank: 2 }, sr_spec: { rank: 3 }, spec: { rank: 4 } };

  const EVENTS = {
    e_riyadh_season: { id: 'e_riyadh_season', tier: 1, nameEn: 'Riyadh Season Opening', nameAr: 'افتتاح موسم الرياض', start: '2026-06-01', end: '2026-06-20', city: 'Riyadh', intl: false },
    e_mdl_beast:     { id: 'e_mdl_beast',     tier: 1, nameEn: 'MDLBEAST Festival',     nameAr: 'مهرجان ميدل بيست',  start: '2026-06-12', end: '2026-06-28', city: 'Jeddah', intl: false },
    e_expo_booth:    { id: 'e_expo_booth',    tier: 2, nameEn: 'Expo Pavilion Build',   nameAr: 'بناء جناح المعرض',  start: '2026-06-05', end: '2026-06-18', city: 'Riyadh', intl: false },
    e_intl_summit:   { id: 'e_intl_summit',   tier: 2, nameEn: 'Dubai Tech Summit',     nameAr: 'قمة دبي للتقنية',   start: '2026-06-15', end: '2026-06-22', city: 'Dubai',  intl: true  },
    e_corp_gala:     { id: 'e_corp_gala',     tier: 2, nameEn: 'Corporate Gala Night',  nameAr: 'حفل الشركة',        start: '2026-06-08', end: '2026-06-10', city: 'Riyadh', intl: false },
    e_marathon:      { id: 'e_marathon',      tier: 3, nameEn: 'City Marathon Logistics',nameAr: 'لوجستيات الماراثون',start: '2026-06-19', end: '2026-06-21', city: 'Riyadh', intl: false },
    e_school_fair:   { id: 'e_school_fair',   tier: 3, nameEn: 'School Fair Setup',      nameAr: 'تجهيز معرض المدرسة',start: '2026-06-24', end: '2026-06-26', city: 'Riyadh', intl: false },
    e_pop_concert:   { id: 'e_pop_concert',   tier: 3, nameEn: 'Pop-up Concert',         nameAr: 'حفل مفاجئ',         start: '2026-06-27', end: '2026-06-29', city: 'Dammam', intl: false },
  };

  const S = 'https://avatars.slack-edge.com/';
  function P(o) { return o; }

  const PEOPLE = [
    // — Top of house —
    P({ id: 'p_hamdi', slackId: '', name: 'Hamdi Missaoui', nameAr: 'حمدي المسعودي', initials: 'HM', level: 'director', managerId: null, title: 'Chief Commercial Officer', titleAr: 'الرئيس التجاري', employment: 'fulltime', assignedEvents: [], dailyCheckin: null }),
    P({ id: 'p_ahmed', slackId: 'U099EREBS23', name: 'Ahmed Othman', nameAr: 'أحمد عثمان', initials: 'AO', level: 'director', managerId: 'p_hamdi', title: 'Event Operations Director', titleAr: 'مدير عمليات الفعاليات', employment: 'fulltime', photo: S + '2026-04-24/10987489079253_5eaec9a8cc3cc0048310_original.png', assignedEvents: [], dailyCheckin: null }),

    // ===== Automation & Execution — Ayman =====
    P({ id: 'p_ayman', slackId: 'U06D1GQ7XL2', name: 'Ayman Albasha', nameAr: 'أيمن الباشا', initials: 'AB', level: 'sr_manager', managerId: 'p_ahmed', team: 'Automation & Execution', teamAr: 'الأتمتة والتنفيذ', title: 'Event Operations Sr. Manager', titleAr: 'مدير أول لعمليات الفعاليات', employment: 'fulltime', photo: S + '2024-11-11/8024758637153_3f81f365db0728908404_original.jpg', assignedEvents: [], dailyCheckin: null }),
    P({ id: 'p_shahad', slackId: 'U06EA95C70W', name: 'Shahad Joudah', nameAr: 'شهد جوده', initials: 'SJ', level: 'spec', managerId: 'p_ayman', title: 'Event Operations Specialist - Trainer', titleAr: 'أخصائية عمليات الفعاليات - مدرّبة', employment: 'fulltime', photo: S + '2025-12-28/10192223299267_959ffd1ed9f113297f14_original.jpg', assignedEvents: ['e_pop_concert'], dailyCheckin: null }),
    // Anti-Fraud sub-group under Ayman
    P({ id: 'p_batool', slackId: 'U06CM0JKYGP', name: 'Batool Emad', nameAr: 'بتول عماد', initials: 'BE', level: 'manager', managerId: 'p_ayman', subteam: 'Anti-Fraud', subteamAr: 'مكافحة الاحتيال', title: 'Event Operations Manager Anti-Fraud', titleAr: 'مدير عمليات الفعاليات - مكافحة الاحتيال', employment: 'fulltime', photo: S + '2025-10-02/9609866850679_74e279d52d0acdb61e3e_original.jpg', assignedEvents: ['e_corp_gala'], dailyCheckin: null }),
    P({ id: 'p_tbc_af_spec', name: 'TBC', nameAr: 'يُحدّد لاحقاً', initials: 'TBC', level: 'spec', managerId: 'p_batool', tbc: true, title: 'Event Operations Specialist Anti-Fraud', titleAr: 'أخصائي عمليات الفعاليات - مكافحة الاحتيال', employment: 'fulltime', assignedEvents: [], dailyCheckin: null }),
    P({ id: 'p_tbc_af_coord', name: 'TBC', nameAr: 'يُحدّد لاحقاً', initials: 'TBC', level: 'spec', managerId: 'p_batool', tbc: true, title: 'Event Operations Coordinator Anti-Fraud', titleAr: 'منسّق عمليات الفعاليات - مكافحة الاحتيال', employment: 'fulltime', assignedEvents: [], dailyCheckin: null }),

    // ===== Sports — Motaa =====
    P({ id: 'p_motaa', slackId: 'U06CYJMJPJR', name: 'Motaa Aldarra', nameAr: 'مطاع الدرة', initials: 'MA', level: 'sr_manager', managerId: 'p_ahmed', team: 'Sports', teamAr: 'الرياضة', title: 'Event Operations Sr. Manager', titleAr: 'مدير أول لعمليات الفعاليات', employment: 'fulltime', photo: S + '2024-02-21/6673336286451_cd85e03b0c0bbb79cdd7_original.png', assignedEvents: ['e_riyadh_season'], dailyCheckin: { plan: 'Lock Riyadh Season ticketing', done: 'Gate plan signed', remaining: 'Stage sign-off', learned: 'New load-in route', at: '2026-06-17T08:40:00' } }),
    P({ id: 'p_akram', slackId: 'U06H0ASQ761', name: 'Mohammed Akram', nameAr: 'محمد أكرم', initials: 'MA', level: 'manager', managerId: 'p_motaa', title: 'Event Operations Manager', titleAr: 'مدير عمليات الفعاليات', employment: 'fulltime', photo: S + '2024-02-04/6593946722801_53f137cdf64568fb3570_original.png', assignedEvents: ['e_mdl_beast', 'e_expo_booth'], dailyCheckin: { plan: 'MDLBEAST staffing grid', done: 'Crew booked', remaining: 'Power supply', learned: 'Faster generator vendor', at: '2026-06-17T08:10:00' } }),
    P({ id: 'p_abdulrahman', slackId: 'U07LF0D3KSN', name: 'A. Maksosah', nameAr: 'عبدالرحمن مقصوصة', initials: 'AM', level: 'sr_spec', managerId: 'p_motaa', title: 'Event Operations Sr. Specialist', titleAr: 'أخصائي أول لعمليات الفعاليات', employment: 'fulltime', photo: S + '2026-01-12/10274801113666_1fbe4f7bcf66ca4624f3_original.png', assignedEvents: ['e_intl_summit', 'e_school_fair'], dailyCheckin: { plan: 'Summit run sheet', done: 'Floor plan v1', remaining: 'Vendor quotes', learned: '—', at: '2026-06-17T08:20:00' } }),
    P({ id: 'p_khaled', slackId: 'U06D1GM1RRQ', name: 'Khaled Jeneina', nameAr: 'خالد جنينة', initials: 'KJ', level: 'sr_spec', managerId: 'p_motaa', title: 'Event Operations Sr. Specialist', titleAr: 'أخصائي أول لعمليات الفعاليات', employment: 'fulltime', photo: S + '2026-01-14/10293227094166_e7874eb989412974c67e_original.png', assignedEvents: ['e_corp_gala'], dailyCheckin: { plan: 'Gala AV', done: 'AV finalized', remaining: 'Guest list', learned: '—', at: '2026-06-17T07:55:00' } }),
    P({ id: 'p_shamma', slackId: 'U09AH1Z1X6C', name: 'Shamma Alsagr', nameAr: 'شما الصقر', initials: 'SA', level: 'spec', managerId: 'p_motaa', title: 'Event Operations Specialist', titleAr: 'أخصائية عمليات الفعاليات', employment: 'fulltime', photo: S + '2025-10-05/9668189448720_833ee0a7c097344689a9_original.jpg', assignedEvents: ['e_school_fair'], dailyCheckin: { plan: 'School fair layout', done: 'Vendor list', remaining: 'Signage', learned: '—', at: '2026-06-17T08:05:00' } }),
    P({ id: 'p_idris', slackId: 'U09E1NA1B0W', name: 'Mohammed Adris', nameAr: 'محمد إدريس', initials: 'MA', level: 'spec', managerId: 'p_akram', title: 'Event Operations Specialist', titleAr: 'أخصائي عمليات الفعاليات', employment: 'fulltime', photo: S + '2026-06-15/11365789882978_4bafd0e08a38c77a3670_original.png', assignedEvents: ['e_pop_concert'], dailyCheckin: { plan: 'Shadow festival team', done: 'Signage checklist', remaining: 'Learning the tools', learned: 'Lots — first weeks', at: '2026-06-17T08:00:00' } }),
    P({ id: 'p_tbc_sports', name: 'TBC', nameAr: 'يُحدّد لاحقاً', initials: 'TBC', level: 'spec', managerId: 'p_motaa', tbc: true, title: 'Event Operations Specialist', titleAr: 'أخصائي عمليات الفعاليات', employment: 'fulltime', assignedEvents: [], dailyCheckin: null }),
    // Freelancers — kept under their existing line managers, tagged freelance
    P({ id: 'p_osama', slackId: 'U08RN9WDKL6', name: 'Osama AlBasha', nameAr: 'أسامة الباشا', initials: 'OA', level: 'spec', managerId: 'p_akram', title: 'Event Operations Specialist', titleAr: 'أخصائي عمليات الفعاليات', employment: 'freelance', photo: S + '2026-05-23/11194956748178_adb8e58f17daeb908d03_original.png', assignedEvents: ['e_mdl_beast', 'e_intl_summit', 'e_marathon'], dailyCheckin: { plan: 'Festival + summit prep', done: 'Two site visits', remaining: 'Both run sheets', learned: 'Stretched thin', at: '2026-06-17T09:05:00' } }),
    P({ id: 'p_gamal', slackId: 'U08RRNYNE6A', name: 'Mohammed Jamal', nameAr: 'محمد جمال', initials: 'MJ', level: 'spec', managerId: 'p_akram', title: 'Event Operations Specialist', titleAr: 'أخصائي عمليات الفعاليات', employment: 'freelance', photo: S + '2025-05-13/8871091980695_f4dc89fce41e5750938c_original.png', assignedEvents: ['e_mdl_beast', 'e_marathon'], dailyCheckin: { plan: 'Festival ground ops', done: 'Vendor walkthrough', remaining: 'Marathon route', learned: 'Strong new crew lead', at: '2026-06-17T08:30:00' } }),
    P({ id: 'p_duha', slackId: '', name: 'Duha Alzahrani', nameAr: 'ضحى الزهراني', initials: 'DA', level: 'spec', managerId: 'p_farah', title: 'Event Operations Specialist', titleAr: 'أخصائية عمليات الفعاليات', employment: 'freelance', assignedEvents: [], dailyCheckin: null }),
    P({ id: 'p_talal', slackId: 'U08SB865W0Z', name: 'Talal', nameAr: 'طلال', initials: 'TA', level: 'spec', managerId: 'p_abdulrahman', title: 'Event Operations Specialist', titleAr: 'أخصائي عمليات الفعاليات', employment: 'freelance', photo: S + '2025-10-02/9621523706694_7e351c3e3a34a08ddd83_original.png', assignedEvents: [], dailyCheckin: { plan: 'Available for assignment', done: 'Helped with gala', remaining: 'Nothing assigned', learned: 'Wants more ownership', at: '2026-06-17T08:00:00' } }),
    P({ id: 'p_ibrahim', slackId: 'U09EF3NPRUZ', name: 'Ibrahim Al-bard', nameAr: 'إبراهيم البارد', initials: 'IA', level: 'spec', managerId: 'p_khaled', title: 'Event Operations Specialist', titleAr: 'أخصائي عمليات الفعاليات', employment: 'freelance', photo: S + '2025-09-08/9473444242659_54d3513cef976a556e43_original.png', assignedEvents: ['e_corp_gala'], dailyCheckin: { plan: 'Gala setup support', done: 'Seating map', remaining: 'AV cabling', learned: '—', at: '2026-06-17T08:15:00' } }),

    // ===== Entertainment — Aya =====
    P({ id: 'p_ayah', slackId: 'U06DE5USEEM', name: 'Aya Nasif', nameAr: 'آية ناصف', initials: 'AN', level: 'sr_manager', managerId: 'p_ahmed', team: 'Entertainment', teamAr: 'الترفيه', title: 'Event Operations Sr. Manager', titleAr: 'مدير أول لعمليات الفعاليات', employment: 'fulltime', photo: S + '2025-10-03/9633258360626_e5386ad93e75920ed6db_original.png', assignedEvents: [], dailyCheckin: null }),
    P({ id: 'p_farah', slackId: 'U0A2W19C2C8', name: 'Farah Alsmay', nameAr: 'فرح السامي', initials: 'FA', level: 'manager', managerId: 'p_ayah', title: 'Event Operations Manager', titleAr: 'مدير عمليات الفعاليات', employment: 'fulltime', photo: S + '2026-01-22/10353853234628_553222f85c03df752008_original.png', assignedEvents: ['e_expo_booth'], dailyCheckin: null }),
    P({ id: 'p_amen', slackId: '', name: 'Amen Shannah', nameAr: 'أمين شنّاح', initials: 'AS', level: 'sr_spec', managerId: 'p_ayah', title: 'Event Operations Sr. Specialist', titleAr: 'أخصائي أول لعمليات الفعاليات', employment: 'fulltime', assignedEvents: [], dailyCheckin: null }),
    P({ id: 'p_meshalB', slackId: 'U09PSSEP0HM', name: 'Meshaal Houshan', nameAr: 'مشعل حوشان', initials: 'MH', level: 'sr_spec', managerId: 'p_ayah', title: 'Event Operations Sr. Specialist', titleAr: 'أخصائي أول لعمليات الفعاليات', employment: 'fulltime', photo: S + '2025-11-12/9883235121751_0604eee177420dca6959_original.png', assignedEvents: ['e_intl_summit'], dailyCheckin: null }),
    P({ id: 'p_meshalA', slackId: 'U0A2W14TK5W', name: 'Meshaal Alsmari', nameAr: 'مشعل السمري', initials: 'MS', level: 'spec', managerId: 'p_ayah', title: 'Event Operations Coordinator', titleAr: 'منسّق عمليات الفعاليات', employment: 'fulltime', assignedEvents: [], dailyCheckin: null }),
    P({ id: 'p_raghdaa', slackId: '', name: 'Raghdaa', nameAr: 'رغداء', initials: 'RG', level: 'spec', managerId: 'p_ayah', joining: '2026-06-21', title: 'Event Operations Coordinator', titleAr: 'منسّق عمليات الفعاليات', employment: 'fulltime', assignedEvents: [], dailyCheckin: null }),
    P({ id: 'p_rana', slackId: 'U0ABANQ0WAG', name: 'Rana Alsalem', nameAr: 'رنا السالم', initials: 'RS', level: 'spec', managerId: 'p_ayah', title: 'Event Operations Specialist', titleAr: 'أخصائية عمليات الفعاليات', employment: 'fulltime', photo: S + '2026-01-27/10374791457907_964aa24ade0d5b613e14_original.png', assignedEvents: ['e_school_fair'], dailyCheckin: null }),

    // ===== On Ground — Hani =====
    P({ id: 'p_hani', slackId: 'U06D1GQ58HG', name: 'Hani Ahmed', nameAr: 'هاني أحمد', initials: 'HA', level: 'sr_manager', managerId: 'p_ahmed', team: 'On Ground', teamAr: 'الميدان', title: 'Event Operations Sr. Manager', titleAr: 'مدير أول لعمليات الفعاليات', employment: 'fulltime', photo: S + '2026-01-29/10398251000210_8c6bc0f588ab1081bca7_original.png', assignedEvents: [], dailyCheckin: null }),
    P({ id: 'p_zaidan', slackId: 'U06G2SHJB9R', name: 'Mohammed Zaidan', nameAr: 'محمد زيدان', initials: 'MZ', level: 'manager', managerId: 'p_hani', title: 'Event Operations Manager - Execution', titleAr: 'مدير عمليات الفعاليات - التنفيذ', employment: 'fulltime', photo: S + '2025-08-08/9320247984950_c75c35bb7476935e3342_original.jpg', assignedEvents: ['e_marathon'], dailyCheckin: null }),
    P({ id: 'p_faraj', slackId: 'U06G5DNPZA8', name: 'Ahmed Faraj', nameAr: 'أحمد فرج', initials: 'AF', level: 'manager', managerId: 'p_hani', title: 'Event Operations Manager - Execution', titleAr: 'مدير عمليات الفعاليات - التنفيذ', employment: 'fulltime', photo: S + '2025-09-28/9593935231221_f8c3f8eaa8c189de7fd5_original.jpg', assignedEvents: ['e_riyadh_season'], dailyCheckin: null }),
    P({ id: 'p_batarfi', slackId: 'U06CUT8FT4N', name: 'Mohammed Batarfi', nameAr: 'محمد باطرفي', initials: 'MB', level: 'sr_spec', managerId: 'p_hani', title: 'Event Operations Sr. Specialist (Logistics)', titleAr: 'أخصائي أول لعمليات الفعاليات (اللوجستيات)', employment: 'fulltime', photo: S + '2026-01-07/10275968135104_8c6bc6f01576ef2943ff_original.png', assignedEvents: [], dailyCheckin: null }),

    P({ id: 'p_fouda', slackId: '', name: 'Ahmed Fouda', nameAr: 'أحمد فودة', initials: 'AF', level: 'manager', managerId: 'p_hani', title: 'Event Operations Manager - Execution', titleAr: 'مدير عمليات الفعاليات - التنفيذ', employment: 'fulltime', assignedEvents: [], dailyCheckin: null }),
    P({ id: 'p_abdelaal', slackId: '', name: 'Ismail Abdelaal', nameAr: 'إسماعيل عبدالعال', initials: 'IA', level: 'manager', managerId: 'p_hani', title: 'Event Operations Manager - Execution', titleAr: 'مدير عمليات الفعاليات - التنفيذ', employment: 'fulltime', assignedEvents: [], dailyCheckin: null }),

    // ===== Cashless — Omar =====
    P({ id: 'p_zarea', slackId: 'U09CC2V09NZ', name: 'Omar Zarei', nameAr: 'عمر زارع', initials: 'OZ', level: 'manager', managerId: 'p_ahmed', team: 'Cashless', teamAr: 'الدفع الإلكتروني', title: 'Event Operations Manager', titleAr: 'مدير عمليات الفعاليات', employment: 'fulltime', photo: S + '2025-09-28/9610706501713_e9746e70723f0eda464c_original.jpg', assignedEvents: ['e_intl_summit'], dailyCheckin: null }),
    P({ id: 'p_rafah', slackId: 'U099C2KP1NU', name: 'Rafah Alansari', nameAr: 'رفاه الأنصاري', initials: 'RF', level: 'sr_spec', managerId: 'p_zarea', title: 'Event Operations Sr. Specialist', titleAr: 'أخصائية أول لعمليات الفعاليات', employment: 'fulltime', photo: S + '2025-10-27/9783415011188_e21952c27f823d0d8c36_original.png', assignedEvents: ['e_expo_booth'], dailyCheckin: null }),
    P({ id: 'p_aljazi', slackId: 'U097HCNCAG3', name: 'Aljazi Alshubaike', nameAr: 'الجازي الشبيكي', initials: 'AA', level: 'sr_spec', managerId: 'p_zarea', title: 'Event Operations Sr. Specialist', titleAr: 'أخصائي أول لعمليات الفعاليات', employment: 'fulltime', photo: S + '2026-06-17/11377561146789_e77f77e8c5519d602401_original.png', assignedEvents: ['e_corp_gala'], dailyCheckin: null }),
    P({ id: 'p_rosa', slackId: 'U09CC2R0H29', name: 'Rosa Alansari', nameAr: 'روزا الأنصاري', initials: 'RA', level: 'spec', managerId: 'p_zarea', title: 'Event Operations Specialist', titleAr: 'أخصائية عمليات الفعاليات', employment: 'fulltime', photo: S + '2025-09-02/9446013743222_95f79433181c565ba618_original.jpg', assignedEvents: ['e_pop_concert'], dailyCheckin: null }),
    P({ id: 'p_altahini', slackId: 'U097HCRUYCB', name: 'Mohammed Altahini', nameAr: 'محمد الطحيني', initials: 'MT', level: 'spec', managerId: 'p_zarea', title: 'Event Operations Specialist', titleAr: 'أخصائي عمليات الفعاليات', employment: 'fulltime', photo: S + '2025-07-28/9248551467783_16b4f569fed9b2f5e808_original.jpg', assignedEvents: ['e_school_fair'], dailyCheckin: null }),
  ];

  // Default any record without an explicit employment to full-time.
  PEOPLE.forEach(function (p) { if (!p.employment) p.employment = 'fulltime'; });

  // ---- Real account directory (verified @webook.com emails) ----
  // Sign-in is keyed on these EXACT emails: one email → one account, no cross-login.
  // akram is the Super Admin (can View-as / open any account + manage access).
  const EMAILS = {
    p_akram: 'akram@webook.com', p_abdulrahman: 'maksousa@webook.com', p_osama: 'o.taher.c@webook.com',
    p_gamal: 'm.ali.c@webook.com', p_talal: 'talal.samir.c@webook.com', p_ahmed: 'ahmed.othman@webook.com',
    p_shamma: 'shamma@webook.com', p_idris: 'mohammed.adris.c@webook.com', p_zaidan: 'zaidan@webook.com',
    p_faraj: 'faraj@webook.com', p_meshalB: 'meshal@webook.com', p_fouda: 'fouda@webook.com',
    p_abdelaal: 'abdelaal@webook.com',
    p_motaa: 'motaa@webook.com',
  };
  PEOPLE.forEach(function (p) {
    if (EMAILS[p.id]) p.email = EMAILS[p.id];
    if (p.id === 'p_akram') p.superAdmin = true;   // Mohammed Akram — Super Admin
  });

  /* Tenure & role history (mocked). Osama = flight-risk story; Idris = new hire. */
  const TENURE = {
    p_ahmed:       { joined: '2018-09-01', roleStart: '2020-01-01', lastProgression: '2024-01-01', tier1Delivered: 16, monthsSinceTier1: 0 },
    p_ayman:       { joined: '2019-05-01', roleStart: '2022-01-01', lastProgression: '2024-06-01', tier1Delivered: 11, monthsSinceTier1: 0 },
    p_motaa:       { joined: '2020-06-15', roleStart: '2023-01-01', lastProgression: '2025-01-01', tier1Delivered: 10, monthsSinceTier1: 0 },
    p_ayah:        { joined: '2021-02-01', roleStart: '2023-08-01', lastProgression: '2025-02-01', tier1Delivered: 8,  monthsSinceTier1: 1 },
    p_hani:        { joined: '2019-10-01', roleStart: '2022-06-01', lastProgression: '2024-09-01', tier1Delivered: 12, monthsSinceTier1: 0 },
    p_akram:       { joined: '2021-09-01', roleStart: '2023-02-01', lastProgression: '2025-06-01', tier1Delivered: 7,  monthsSinceTier1: 0 },
    p_khaled:      { joined: '2021-03-01', roleStart: '2023-06-01', lastProgression: '2025-02-01', tier1Delivered: 4,  monthsSinceTier1: 1 },
    p_abdulrahman: { joined: '2022-01-01', roleStart: '2024-03-01', lastProgression: '2024-09-01', tier1Delivered: 5,  monthsSinceTier1: 2 },
    p_batool:      { joined: '2022-04-01', roleStart: '2024-01-01', lastProgression: '2025-01-01', tier1Delivered: 3,  monthsSinceTier1: 2 },
    p_farah:       { joined: '2022-08-01', roleStart: '2024-05-01', lastProgression: '2025-05-01', tier1Delivered: 3,  monthsSinceTier1: 1 },
    p_faraj:       { joined: '2021-11-01', roleStart: '2023-09-01', lastProgression: '2025-03-01', tier1Delivered: 4,  monthsSinceTier1: 1 },
    p_zarea:       { joined: '2024-09-01', roleStart: '2024-09-01', lastProgression: '2024-09-01', tier1Delivered: 1,  monthsSinceTier1: 3 },
    p_batarfi:     { joined: '2020-01-01', roleStart: '2022-01-01', lastProgression: '2024-01-01', tier1Delivered: 6,  monthsSinceTier1: 2 },
    p_idris:       { joined: '2026-05-04', roleStart: '2026-05-04', lastProgression: '2026-05-04', tier1Delivered: 0,  monthsSinceTier1: 99 },
    p_gamal:       { joined: '2024-03-01', roleStart: '2024-03-01', lastProgression: '2025-04-01', tier1Delivered: 2,  monthsSinceTier1: 0 },
    p_osama:       { joined: '2023-01-09', roleStart: '2024-09-01', lastProgression: '2024-09-01', tier1Delivered: 4,  monthsSinceTier1: 0 },
    p_ibrahim:     { joined: '2025-02-01', roleStart: '2025-02-01', lastProgression: '2025-02-01', tier1Delivered: 0,  monthsSinceTier1: 6 },
    p_shamma:      { joined: '2024-10-01', roleStart: '2024-10-01', lastProgression: '2024-10-01', tier1Delivered: 1,  monthsSinceTier1: 3 },
    p_talal:       { joined: '2024-08-01', roleStart: '2024-08-01', lastProgression: '2024-08-01', tier1Delivered: 0,  monthsSinceTier1: 9 },
    p_shahad:      { joined: '2025-06-01', roleStart: '2025-06-01', lastProgression: '2025-06-01', tier1Delivered: 0,  monthsSinceTier1: 7 },
    p_meshalB:     { joined: '2024-04-01', roleStart: '2025-01-01', lastProgression: '2025-01-01', tier1Delivered: 2,  monthsSinceTier1: 2 },
    p_meshalA:     { joined: '2026-01-15', roleStart: '2026-01-15', lastProgression: '2026-01-15', tier1Delivered: 0,  monthsSinceTier1: 99 },
    p_rana:        { joined: '2025-09-01', roleStart: '2025-09-01', lastProgression: '2025-09-01', tier1Delivered: 0,  monthsSinceTier1: 5 },
    p_zaidan:      { joined: '2024-06-01', roleStart: '2024-06-01', lastProgression: '2024-06-01', tier1Delivered: 1,  monthsSinceTier1: 4 },
    p_aljazi:      { joined: '2024-11-01', roleStart: '2025-06-01', lastProgression: '2025-06-01', tier1Delivered: 1,  monthsSinceTier1: 3 },
    p_rosa:        { joined: '2025-08-01', roleStart: '2025-08-01', lastProgression: '2025-08-01', tier1Delivered: 0,  monthsSinceTier1: 6 },
    p_altahini:    { joined: '2025-05-01', roleStart: '2025-05-01', lastProgression: '2025-05-01', tier1Delivered: 0,  monthsSinceTier1: 7 },
    p_rafah:       { joined: '2024-12-01', roleStart: '2025-06-01', lastProgression: '2025-06-01', tier1Delivered: 1,  monthsSinceTier1: 3 },
  };
  PEOPLE.forEach(function (p) { Object.assign(p, TENURE[p.id] || {}); });

  const CEILING = 100;
  WP.data = { TIERS, STATES, HEALTHY_STATE, LEVELS, EVENTS, PEOPLE, CEILING };
})(window.WP = window.WP || {});
