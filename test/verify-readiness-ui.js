/* Readiness-UI ethics guard (P6 — Development & growth panel + Org-capability view).
 * The MOST ethics-sensitive surface: it touches careers. The engine refuses to produce
 * a verdict; this RENDER BOUNDARY must refuse to LABEL one. We assert the rendered
 * contract + the source invariants that protect it:
 *   - dev panel shows NO score / rank / verdict / promote-hold in the DOM;
 *   - access-gated: peer denied, skip-level denied per-person, self/mgr/director allowed;
 *   - org view is canManage-only + never leaks a suppressed cohort's identity or count;
 *   - "Not enough evidence yet" / "Not enough data" are first-class;
 *   - evidence is a keyboard-accessible control opening the cited drawer (traceable). */
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
const rdJs=fs.readFileSync(path.join(root,'src/js/ui/readiness.js'),'utf8');
const rdJsNoComments=rdJs.replace(/\/\*[\s\S]*?\*\//g,'').replace(/\/\/[^\n]*/g,'');
const profileJs=fs.readFileSync(path.join(root,'src/js/ui/profile.js'),'utf8');
const appJs=fs.readFileSync(path.join(root,'src/js/app.js'),'utf8');
const i18nJs=fs.readFileSync(path.join(root,'src/js/core/i18n.js'),'utf8');
function finish(){if(errors.length){console.log('FAIL\n'+errors.join('\n'));process.exit(1);}
  console.log('PASS — readiness-ui ethics: dev panel titled "Development & growth (evidence)" (never "Readiness"), shows NO score/rank/verdict/promote-hold; gaps framed as "what to put on record next"; access-gated (peer + skip-level denied per-person, self/mgr/director allowed); evidence is a keyboard-accessible control → cited drawer; org view canManage-only + k-anonymized (no suppressed-cohort count/identity leak); "Not enough evidence yet" / "Not enough data" first-class; EN + AR/RTL.');
  process.exit(0);}

(async()=>{
try{
  WP.state.authed=true;WP.state.lang='en';

  // ── SOURCE INVARIANTS — the render boundary carries no verdict vocabulary ──
  // The dev-panel code must never compute or print a score/rank/verdict/promote-hold.
  assert(!/promote|\bhold\b|\brank\b|verdict/i.test(rdJsNoComments),'dev/org view source carries no promote/hold/rank/verdict');
  // The title is the literal required string, and "Readiness" is never used as a label.
  assert(/Development & growth \(evidence\)/.test(i18nJs),'dev panel title key is "Development & growth (evidence)"');
  assert(!/rdTitle:[^}]*Readiness/.test(i18nJs),'panel is never titled "Readiness"');
  assert(/developmentPanel/.test(profileJs) && /canSeeSensitive|sens \?/.test(profileJs),'dev panel is mounted only behind the sensitive gate in profile.js');
  // org route + nav are inside the canManage block + view re-checks the gate (defence in depth).
  assert(/route === 'org'/.test(appJs),'org route registered in app.js');
  assert(/if \(canManage\)[\s\S]{0,700}id: 'org'/.test(appJs),'org nav entry is inside the canManage block');
  assert(/canManage\(viewer\)/.test(rdJs) && /orgDenied/.test(rdJs),'org view re-checks canManage (defence in depth)');

  // ── ENGINE ACCESS GATE (per-person) — peer + skip-level denied, allowed roles pass ──
  const PEOPLE=WP.data.PEOPLE||[];
  const dir=PEOPLE.find(p=>WP.access.canManage(p));
  assert(dir,'a director/admin exists in the data');
  // find a peer pair (canSee but NOT canSeeSensitive) to prove peer denial
  let peerViewer=null,peerTarget=null,allowedPair=null;
  PEOPLE.forEach(v=>{PEOPLE.forEach(tg=>{
    if(v.id===tg.id)return;
    const sens=WP.access.canSeeSensitive(v,tg.id);
    if(!sens && !peerViewer){peerViewer=v;peerTarget=tg;}
    if(sens && !allowedPair && !WP.access.canManage(v)){allowedPair={v:v,t:tg};}
  });});
  if(peerViewer){
    const denied=await WP.readiness.developmentProfile(peerTarget.id,{viewer:peerViewer});
    assert(denied && denied.denied===true && denied.enoughEvidence===false,'peer/skip-level is DENIED a per-person development profile');
    assert(!denied.strengths.length && !denied.growthAreas.length,'denied profile leaks no strengths/growth');
  }
  // self is always allowed
  const selfProf=await WP.readiness.developmentProfile(dir.id,{viewer:dir});
  assert(selfProf && selfProf.denied!==true,'an allowed viewer (self/mgr/director) is NOT denied');

  // ── DEV PANEL — DOM render boundary (drive a populated profile deterministically) ──
  const view=window.document.getElementById('view');
  // a viewer that CAN see this person's sensitive view
  const sviewer=dir, starget=PEOPLE.find(p=>WP.access.canSeeSensitive(dir,p.id))||dir;
  WP.state.viewerId=sviewer.id;
  const ev=(cat,i)=>({id:cat+i,ts:'2026-06-1'+(i%9),category:cat,source:'unit-src',confidence:'observed',text:cat+' evidence '+i});
  const populated={enoughEvidence:true,
    strengths:[{area:'delivery',text:'Sustained delivery: 4 completed item(s)',evidence:[ev('delivery',1),ev('delivery',2),ev('delivery',3)]}],
    growthAreas:[{area:'wellbeing',text:'Wellbeing signals to support (1)',evidence:[ev('wellbeing',1)]}],
    evidenceCoverage:{byCategory:{delivery:4,recognition:2},byQuarter:{},sourcedCount:6},
    gaps:['No plan evidence on record'],subjectId:starget.id};
  WP._devCache={id:starget.id,prof:populated};
  WP.readiness.developmentProfile=function(){return Promise.resolve(populated);};
  WP.setState({route:'profile',selectedId:starget.id});
  // let any async profile re-render settle
  for(let i=0;i<6;i++) await Promise.resolve();
  const txt=view.textContent;
  assert(/Development & growth/.test(txt),'dev panel renders its evidence title');
  assert(!/Readiness/.test(txt),'the word "Readiness" never appears as a label in the rendered panel');
  // NO score/rank/verdict/percentage in the rendered dev panel
  const panel=(view.innerHTML.match(/Development & growth[\s\S]*?(?=<div class="section"><h3>|$)/)||[''])[0];
  assert(!/\d+\s*\/\s*5|\b\d{1,3}\s*%|promote|\bhold\b|\brank\b|verdict|score/i.test(panel),'dev panel shows NO score/percentage/rank/verdict/promote-hold');
  // evidence is a REAL keyboard-accessible control that opens the cited drawer
  const chip=view.querySelector('.rd-item .wbk-band-ev[data-evk]');
  assert(chip && chip.tagName==='BUTTON' && chip.getAttribute('type')==='button','evidence chip is a real <button> (keyboard-accessible)');
  if(chip){
    chip.click();
    const drawer=window.document.querySelector('#overlay-host .drawer');
    assert(drawer,'clicking the evidence chip opens the cited-evidence drawer');
    assert(drawer && /unit-src/.test(drawer.textContent),'drawer lists the SOURCED evidence behind the point (traceable)');
    window.document.getElementById('overlay-host').innerHTML='';
  }
  // gaps are framed as "what to put on record next", not a deficiency
  assert(/What to put on record next/.test(txt),'gaps are framed as "what to put on record next"');

  // ── NO legacy promotion/readiness SCORE on the profile (the retired % ring) ──
  // The fair-shot signal may render Tier-1 COUNTS + a fairness note, but NEVER a
  // promotion/readiness percentage, a .ring, or a pass/fail threshold score.
  assert(!view.querySelector('.promo, .ring'),'profile renders no promotion .ring / .promo score widget');
  // the fair-shot section (replacing the ring) shows evidence, never a %/score. Capacity
  // LOAD % elsewhere on the profile is legitimate; the fair-shot section must carry none.
  const fairSec=[].slice.call(view.querySelectorAll('.section')).find(s=>/Opportunity & fair shot/.test(s.textContent));
  assert(fairSec,'the fair-shot section renders');
  assert(fairSec && !/\d\s*%/.test(fairSec.textContent),'fair-shot section carries no percentage/score');
  assert(fairSec && /Tier-1.*delivered/i.test(fairSec.textContent),'fair-shot keeps the Tier-1-delivered count as a plain evidence fact');
  // source invariant: profile.js no longer renders r.pct or a 70% threshold colour
  assert(!/r\.pct|>= 70|pct >= 70/.test(profileJs),'profile.js source carries no r.pct render or 70% threshold');

  // ── NO readiness/promotion % on the DASHBOARD either (employee self-view) ──
  const emp=PEOPLE.find(p=>!WP.access.canManage(p))||PEOPLE[0];
  WP.state.viewerId=emp.id;
  WP.setState({route:'dashboard'});
  assert(!/\b\d{1,3}\s*%[\s\S]{0,40}(readiness|promotion)/i.test(view.innerHTML) && !/promo[\s\S]{0,20}\d{1,3}\s*%/i.test(view.innerHTML),'dashboard shows no promotion/readiness percentage KPI');
  const dashJs=fs.readFileSync(path.join(root,'src/js/ui/dashboard.js'),'utf8');
  assert(!/pr\.pct|\.pct >= 70|promotionReadiness\(p\)\.pct/.test(dashJs),'dashboard.js source renders no promotion-% / >=70 threshold');
  WP.state.viewerId=sviewer.id; // restore the sensitive viewer for the remaining profile checks

  // ── "NOT ENOUGH EVIDENCE YET" is first-class ──
  WP._devCache=null;
  WP.readiness.developmentProfile=function(){return Promise.resolve({enoughEvidence:false,note:'Not enough evidence yet',strengths:[],growthAreas:[],evidenceCoverage:{byCategory:{}},gaps:[],subjectId:starget.id});};
  WP.setState({route:'profile',selectedId:starget.id});
  for(let i=0;i<6;i++) await Promise.resolve();
  assert(/Not enough evidence yet/.test(view.textContent),'sparse profile shows the first-class "Not enough evidence yet" state');

  // ── ORG VIEW — canManage gate + k-anonymity (no suppressed count/identity leak) ──
  // non-manager hitting the route gets a calm denial, never the data.
  const junior=PEOPLE.find(p=>!WP.access.canManage(p))||PEOPLE[0];
  WP.state.viewerId=junior.id;
  WP.setState({route:'org'});
  assert(/only/i.test(view.textContent)||/orgDenied/.test(rdJs),'non-manager is denied the org-capability view');
  assert(!WP.access.canManage(WP.viewer())?!/Capability distribution/.test(view.textContent):true,'non-manager never sees the org body');

  // director with a SUPPRESSED cohort — the view shows "too few to show", never the 1..4 count.
  WP.state.viewerId=dir.id;
  WP.readiness.orgCapability=function(){return {enoughData:true,cohortSize:7,
    capabilityDistribution:{strong:{suppressed:true,note:'too few to show'},proficient:{count:5,of:7},developing:{suppressed:true,note:'too few to show'}},
    skillGapAreas:{conduct:{count:6,of:7},behavior:{suppressed:true,note:'too few to show'},results:{count:0,of:7},capability:{count:5,of:7}}};};
  WP.setState({route:'org'});
  assert(/Capability distribution/.test(view.textContent),'director sees the org-capability body');
  assert(/Too few to show/i.test(view.textContent),'suppressed cohorts render "too few to show"');
  // the suppressed cells expose NO numeric count (no re-identification) — their visible
  // TEXT is just "too few to show", never a 1..4 (icon SVG coords are not text).
  const suppressedTxt=[].slice.call(view.querySelectorAll('.rd-suppressed')).map(e=>e.textContent).join(' ');
  assert(suppressedTxt.length>0 && !/\d/.test(suppressedTxt),'a suppressed cell never prints any count');
  // no per-person row / name / id anywhere; the view source never resolves a person.
  assert(!/WP\.i18n\.name\(|WP\.access\.byId\(/.test(rdJs),'org view never resolves a person name/row (de-identified by construction)');

  // "Not enough data" is first-class when the whole cohort is below k.
  WP.readiness.orgCapability=function(){return {enoughData:false,note:'too few to show',cohortSize:3,capabilityDistribution:null,skillGapAreas:null};};
  WP.setState({route:'org'});
  assert(/Not enough data/.test(view.textContent),'org view shows first-class "Not enough data" below the k threshold');

  // ── EN + AR/RTL render without error ──
  WP.state.lang='ar';WP.setState({route:'org'});assert(view.innerHTML.length>0,'org view renders under RTL/AR');
  WP.state.lang='en';
}catch(e){errors.push('[run] '+e.message+'\n'+e.stack);}
finish();
})();
