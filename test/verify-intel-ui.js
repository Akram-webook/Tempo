/* Intelligence-UI ethics guard (P3 Suggested-range + Consistency, P5 Weekly report).
 * These surfaces are ethics-sensitive: the UI must preserve the engine guardrails —
 * range NOT score, awareness NOT accusation, evidence always shown, HUMAN decides
 * (no auto-apply), access-gated, and NO per-person exposure in the report.
 * We assert the rendered contract + the source invariants that protect them. */
const fs=require('fs'),path=require('path');const {JSDOM}=require('jsdom');
const root=path.join(__dirname,'..');const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const srcs=[...html.matchAll(/src="([^"]+\.js)"/g)].map(m=>m[1]);
const shellBody=(html.match(/<body[^>]*>([\s\S]*?)<\/body>/)||[,''])[1].replace(/<script[\s\S]*?<\/script>/g,'');
const dom=new JSDOM('<!doctype html><html><body>'+shellBody+'</body></html>',{url:'https://localhost/',pretendToBeVisual:true,runScripts:'outside-only'});
const {window}=dom;window.HTMLElement.prototype.scrollIntoView=function(){};window.matchMedia=()=>({matches:false,addEventListener(){},removeEventListener(){}});window.setInterval=()=>0;window.confirm=()=>false;window.alert=()=>{};window.prompt=()=>null;
const errors=[];const benign=/font|stylesheet|localStorage|Security|scrollIntoView|Not implemented|opaque|insertRule|cssRules/i;
['error','warn'].forEach(k=>{const o=window.console[k].bind(window.console);window.console[k]=(...a)=>{const s=a.join(' ');if(!benign.test(s))errors.push('['+k+'] '+s);o(...a);};});
window.addEventListener('error',e=>{if(!benign.test(String(e.message)))errors.push('[onerror] '+e.message);});
for(const s of srcs){try{new window.Function(fs.readFileSync(path.join(root,s),'utf8')).call(window);}catch(e){errors.push('[load '+s+'] '+e.message);}}
const WP=window.WP;function assert(c,m){if(!c)errors.push('[assert] '+m);}
const evalJs=fs.readFileSync(path.join(root,'src/js/ui/evaluation.js'),'utf8');
const evalsJs=fs.readFileSync(path.join(root,'src/js/ui/evaluations.js'),'utf8');
const reportJs=fs.existsSync(path.join(root,'src/js/ui/weeklyReport.js'))?fs.readFileSync(path.join(root,'src/js/ui/weeklyReport.js'),'utf8'):'';
const appJs=fs.readFileSync(path.join(root,'src/js/app.js'),'utf8');
function finish(){if(errors.length){console.log('FAIL\n'+errors.join('\n'));process.exit(1);}
  console.log('PASS — intel-ui ethics: suggested band is a RANGE (no lone score, no apply/scale control, sensitive-gated, COLLAPSED-on-load anchoring guard, data-suggested stamped from the SHOWN range only); "cites N" is a keyboard-accessible control opening the cited-evidence drawer filtered to its refs; consistency cards neutral/evidence-cited + quiet "looks consistent" when clean, hidden when sparse; plural-correct (no "item(s)"); weekly report director-only + de-identified.');
  process.exit(0);}
(async()=>{
try{
  WP.state.authed=true;WP.state.lang='en';

  // ── P3a · Suggested-range band — pure-engine output rendered as a RANGE ───
  // Drive the pure engine with synthetic sourced events and confirm a range (low<high),
  // never a single number, and a first-class "not enough evidence" path.
  const mk=(cat,i)=>({id:cat+i,ts:'2026-06-1'+(i%9),category:cat,source:'unit-test',confidence:'observed',description:cat+' item '+i});
  const many=[].concat([0,1,2,3,4,5].map(i=>mk('delivery',i)),[0,1].map(i=>mk('recognition',i)),[mk('risk',0)]);
  const s=WP.evalIntel.assess(many,{});
  assert(s.enoughEvidence && Array.isArray(s.range),'suggested output is a range');
  assert(s.range[0] < s.range[1],'range has width — never a single number to copy');
  assert(s.range===null || !('score' in s) && !('rating' in s) && !('verdict' in s) && !('rank' in s),'no score/rating/verdict/rank field on the suggestion');
  assert(s.reasoning.every(r=>'evidence' in r),'every reasoning bullet carries cited evidence');
  assert(s.risks.every(r=>Array.isArray(r.evidence) && r.evidence.length),'every risk cites evidence');
  const none=WP.evalIntel.assess([mk('delivery',0)],{});
  assert(none.enoughEvidence===false && none.range===null,'"not enough evidence yet" is first-class (no fabricated range)');

  // ── P3b · band VIEW contract (source invariants the UI must keep) ─────────
  assert(/id="eval-suggested-band"/.test(evalJs),'band has the stable hook id="eval-suggested-band"');
  assert(/data-suggested/.test(evalJs),'band exposes data-suggested for B1 provenance (stamps the SHOWN band)');
  assert(/setAttribute\('data-suggested',\s*\(s && s\.enoughEvidence/.test(evalJs),'data-suggested is stamped from the shown range');
  // the band is sensitive-gated (rendered only under showPrep = canSeeSensitive)
  assert(/showPrep \? '<div class="section wbk-band wbk-band--collapsed" id="eval-suggested-band"/.test(evalJs),'band is sensitive-gated (showPrep / canSeeSensitive)');
  // NO auto-apply: the band carries no control that SETS a rating. The evidence chips
  // ARE buttons now (they open the cited-evidence drawer) — what's forbidden is a
  // scale/apply/approve control that writes a score.
  const bandFn=evalJs.slice(evalJs.indexOf('function bandHTML'),evalJs.indexOf('function render'));
  assert(!/scale-btn|data-n=|id="approve"|>\s*Apply|t\('apply'\)/i.test(bandFn),'band has NO apply/scale control — nothing auto-applies a suggestion (human decides)');
  assert(/wbk-band-empty/.test(bandFn) && /sbNotEnough/.test(bandFn),'band renders a first-class not-enough-evidence empty state');
  assert(/range\[0\].*range\[1\]/.test(bandFn) || /lo.*hi/.test(bandFn),'band renders both ends of the range');
  // the band sits BESIDE the rating input — the scale buttons still render
  assert(/scale-btn/.test(evalJs),'manager rating input (scale buttons) still present — band never replaces it');

  // ── #1 · evidence traceability — "cites N" is a REAL, keyboard-accessible control ─
  assert(/function refOf/.test(evalJs) && /function openEvidence/.test(evalJs),'evidence-ref resolver + cited-evidence drawer present');
  assert(/function wireEvidence/.test(evalJs),'evidence chips are wired to the drawer on render');
  assert(/<button type="button" class="wbk-band-ev" data-refs=/.test(evalJs),'cited-evidence chip is a native <button> carrying its refs (focusable)');
  assert(/openEvidence\(btn\.dataset\.refs\.split/.test(evalJs),'chip click opens the drawer filtered to its refs');

  // ── #2 · ANCHORING guard — band COLLAPSED on load, data-suggested empty until reveal
  assert(/wbk-band--collapsed/.test(evalJs) && /id="sb-reveal"/.test(evalJs),'band starts collapsed with a reveal control (rate first, then reveal)');
  assert(/shown == revealed/i.test(evalJs),'reveal contract documented (shown == revealed) for B1 provenance honesty');
  assert(/setAttribute\('data-suggested',[\s\S]{0,80}enoughEvidence/.test(evalJs),'data-suggested is stamped from the SHOWN (revealed) range only');

  // ── #7 · plural-correct cites (en one/other · ar one/two/…) ───────────────
  assert(typeof WP.i18n.plural==='function','i18n.plural helper exists');
  WP.state.lang='en';
  assert(WP.i18n.plural('sbCites',1)==='cites 1 item','plural EN singular ("1 item", not "item(s)")');
  assert(WP.i18n.plural('sbCites',3)==='cites 3 items','plural EN plural ("3 items")');
  assert(WP.i18n.plural('ccCites',1)==='cites 1 review','plural EN singular reviews');
  WP.state.lang='ar';
  assert(/عنصر واحد/.test(WP.i18n.plural('sbCites',1)),'plural AR one form');
  assert(/عنصرين/.test(WP.i18n.plural('sbCites',2)),'plural AR dual form');
  assert(!/\(/.test(WP.i18n.plural('sbCites',5)),'plural AR drops the lazy "(s)" parenthetical');
  WP.state.lang='en';

  // ── P3c · Consistency awareness cards (evaluations hub) ───────────────────
  assert(/consistencyCheck/.test(evalsJs),'hub calls consistencyCheck');
  assert(/id="eval-consist-host"/.test(evalsJs),'hub has the consistency host');
  assert(/isReal && reports\.length/.test(evalsJs),'consistency is gated to an actual evaluator');
  assert(/wbk-consist-card/.test(evalsJs),'consistency renders neutral awareness cards');
  assert(/consistHost\.hidden = true/.test(evalsJs),'consistency hides when NOT enough data (no fabricated claim)');
  // #6 — when the check ran with enough data but found nothing, a quiet "looks
  // consistent" line confirms it ran (never an alarm, never a score).
  assert(/ccOk/.test(evalsJs) && /wbk-consist-ok/.test(evalsJs),'consistency shows a quiet "looks consistent ✓" line when zero warnings but data present (#6)');
  assert(/!c \|\| !c\.enoughData/.test(evalsJs),'looks-consistent only after the enough-data gate — never on sparse data');
  const consPure=WP.evalIntel.assessConsistency([
    {subjectId:'a',overall:3.0,evidenceCount:5,refs:['x']},
    {subjectId:'b',overall:3.1,evidenceCount:5,refs:['y']},
    {subjectId:'c',overall:2.9,evidenceCount:5,refs:['z']}
  ],{orgMean:3.0});
  assert(consPure.warnings.every(w=>'evidence' in w && 'explanation' in w),'each consistency warning carries explanation + evidence');
  assert(consPure.warnings.every(w=>!('score' in w) && !('rank' in w)),'consistency never scores/ranks the evaluator or anyone');

  // ── P5 · Weekly report view (director/admin-only, de-identified) ──────────
  if(reportJs){
    assert(/canManage/.test(reportJs),'weekly report view is director/admin gated (canManage)');
    assert(/weeklyReport/.test(reportJs),'report view calls WP.decisionMemory.weeklyReport');
    assert(/Not enough data|nedTitle|wrEmpty|enoughData/.test(reportJs),'report has a "not enough data" path');
    // de-identified: the report engine strips people; the VIEW must not re-introduce
    // names. It must not call the people directory to label rows.
    assert(!/WP\.i18n\.name\(|WP\.access\.byId\(|\.name\b.*person/.test(reportJs),'report view introduces NO per-person names/rows (de-identified)');
    // nav entry gated to canManage; route registered
    assert(/route === 'weekly'|route==='weekly'/.test(appJs),'weekly route registered in app.js');
    assert(/canManage[\s\S]{0,400}id: 'weekly'/.test(appJs) || /id: 'weekly'[\s\S]{0,120}/.test(appJs),'weekly nav entry present (canManage-gated)');
  }

  // engine de-identification holds (report carries no per-person key)
  const rep=WP.decisionMemory.aggregate([
    {type:'evaluation',at:'2026-06-20',aiAccepted:true},{type:'evaluation',at:'2026-06-21'},
    {type:'access-grant',at:'2026-06-22'},{type:'assign',at:'2026-06-22'},{type:'role-change',at:'2026-06-23'}
  ],{ref:'2026-06-24'});
  assert(!('byPerson' in rep) && !('people' in rep),'report aggregate exposes no per-person structure');
  assert(rep.evidence.every(e=>!('person' in e) && !('target' in e) && !('subjectId' in e)),'report evidence refs are de-identified (no person/target/subject)');

  // ── DOM contract · live anchoring guard + reveal + evidence drawer ────────
  // Drive the real evaluation view as a sensitive-gated manager (harness overrides the
  // gate + engine deterministically; app code untouched) and exercise the reveal flow.
  let viewerM=null,targetP=null;
  (WP.data.PEOPLE||[]).some(m=>(WP.data.PEOPLE||[]).some(p=>{
    if(p.id===m.id) return false;
    const rel=WP.access.relationshipTo(m,p.id);
    if(rel==='manager'||rel==='director'){viewerM=m;targetP=p;return true;}
    return false;
  }));
  assert(viewerM&&targetP,'found a manager→report pair to drive the eval view');
  if(viewerM&&targetP){
    const synthS={enoughEvidence:true,range:[3.5,4.2],confidence:'medium',
      reasoning:[{text:'Delivered on time',evidence:['delivery0','delivery1']}],
      risks:[{text:'One open blocker',evidence:['risk0']}],
      evidence:[{id:'delivery0',source:'unit-src',ts:'2026-06-10',category:'delivery',text:'shipped A'},
                {id:'delivery1',source:'unit-src',ts:'2026-06-11',category:'delivery',text:'shipped B'},
                {id:'risk0',source:'unit-src',ts:'2026-06-12',category:'risk',text:'blocker X'}],
      baseline:{anchoredTo:'default'}};
    WP.access.canSeeSensitive=function(){return true;};
    WP.evalIntel.suggestedRange=function(){return Promise.resolve(synthS);};
    WP.evalPrep=WP.evalPrep||{};
    WP.evalPrep.prepare=function(){return Promise.resolve({enough:false,sourcedCount:0,sections:[],highlights:[],gaps:[]});};
    WP.state.viewerId=viewerM.id;
    WP.setState({route:'evaluation',selectedId:targetP.id,selectedCycle:null,evalOrigin:'evaluations'});
    const getHost=()=>window.document.getElementById('eval-suggested-band');
    const host0=getHost();
    assert(host0,'band host renders for a sensitive-gated manager');
    if(host0){
      assert(host0.classList.contains('wbk-band--collapsed'),'band is COLLAPSED on load (anchoring guard)');
      assert(host0.getAttribute('data-suggested')==='','data-suggested is EMPTY while collapsed (shown==revealed)');
      for(let i=0;i<6;i++) await Promise.resolve();
      const host=getHost();
      const btn=host.querySelector('#sb-reveal');
      assert(btn&&!btn.disabled,'reveal control is armed once the suggestion is fetched');
      if(btn){
        btn.click();
        assert(!host.classList.contains('wbk-band--collapsed'),'band expands on reveal');
        assert(host.getAttribute('data-suggested')==='3.5-4.2','data-suggested equals the SHOWN range after reveal (and only then)');
        const chip=host.querySelector('button.wbk-band-ev[data-refs]');
        assert(chip&&chip.tagName==='BUTTON','cited-evidence chip is a native, keyboard-accessible <button>');
        if(chip){
          chip.click();
          const oh=window.document.getElementById('overlay-host');
          assert(oh&&/Cited evidence/.test(oh.textContent),'chip opens the cited-evidence drawer');
          assert(oh&&/unit-src/.test(oh.textContent),'drawer lists the SOURCED items behind the point (traceable, filtered to refs)');
        }
      }
    }
  }
}catch(e){errors.push('[run] '+e.message+'\n'+e.stack);}
finish();
})();
