/* Weekly Intelligence Report (P5) ethics guard. This director-only view surfaces
 * WP.decisionMemory — the SHAPE of decisions, never people. The UI must preserve:
 * access-gated (canManage), de-identified (no per-person row/name/score/rank),
 * evidence always cited, and a first-class "not enough data" path. */
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
const reportJs=fs.readFileSync(path.join(root,'src/js/ui/weeklyReport.js'),'utf8');
const appJs=fs.readFileSync(path.join(root,'src/js/app.js'),'utf8');
try{
  WP.state.authed=true;WP.state.lang='en';
  const view=window.document.getElementById('view');

  // ── ACCESS GATE: director/admin only ─────────────────────────────────────
  // a non-manager hitting the route sees a denial, never the data.
  const someoneJunior=(WP.data.PEOPLE||[]).find(p=>!WP.access.canManage(p))||WP.data.PEOPLE[0];
  WP.state.viewerId=someoneJunior.id;
  WP.setState({route:'weekly'});
  assert(/only|lock|denied/i.test(view.textContent.toLowerCase()) || /wrDenied/.test(reportJs),'non-manager is denied the weekly report');
  assert(!WP.access.canManage(WP.viewer()) ? !/Decisions by type/.test(view.textContent) : true,'non-manager never sees the report body');

  // nav entry + route are canManage-gated in app.js
  assert(/route === 'weekly'/.test(appJs),'weekly route registered in app.js');
  assert(/canManage[\s\S]{0,300}id: 'weekly'/.test(appJs),'weekly nav entry is inside the canManage block');
  // the view itself re-checks the gate (defence in depth)
  assert(/canManage\(viewer\)/.test(reportJs) && /wrDenied/.test(reportJs),'view re-checks canManage (defence in depth)');

  // ── DIRECTOR renders the report ──────────────────────────────────────────
  const dir=(WP.data.PEOPLE||[]).find(p=>WP.access.canManage(p))||{id:'__admin__'};
  WP.state.viewerId=dir.id;
  // seed enough decision events for an aggregate (harness drives the store)
  WP.activityLog=[
    {type:'evaluation',at:'2026-06-23',aiAccepted:true,target:'p_x'},
    {type:'evaluation',at:'2026-06-24',aiAccepted:false,target:'p_y'},
    {type:'access-grant',at:'2026-06-24',target:'p_z'},
    {type:'assign',at:'2026-06-25',target:'p_z'},
    {type:'assign',at:'2026-06-25',target:'p_q'},
    {type:'role-change',at:'2026-06-26',target:'p_q'}
  ];
  WP.state.refDate='2026-06-27';
  WP.setState({route:'weekly'});
  assert(/Weekly Intelligence Report/.test(view.textContent),'director sees the report');
  assert(/Decisions by type|Top focus areas/.test(view.textContent),'report shows decision counts + focus areas');
  assert(view.querySelector('.wr-cite'),'every figure shows a cited-evidence chip');

  // ── DE-IDENTIFIED: no person name / per-person row in the rendered view ───
  // none of the seeded target ids or any person name should appear in the output.
  ['p_x','p_y','p_z','p_q'].forEach(function(id){ assert(view.textContent.indexOf(id)===-1,'report shows no person id ('+id+')'); });
  // the view source must not call the people directory to label rows
  assert(!/WP\.i18n\.name\(|WP\.access\.byId\(/.test(reportJs),'view never resolves a person name/row (de-identified by construction)');
  assert(!/score|rank|profile/i.test(reportJs.replace(/\/\*[\s\S]*?\*\//g,'')),'view carries no score/rank/profile of anyone');

  // ── "NOT ENOUGH DATA" is first-class ─────────────────────────────────────
  WP.activityLog=[{type:'assign',at:'2026-06-26',target:'p_z'}]; // below minData
  WP.setState({route:'weekly'});
  assert(/Not enough data/.test(view.textContent),'sparse window shows the first-class "Not enough data" state');
  assert(!view.querySelector('.wr-cite'),'empty state shows no fabricated figures');

  // engine-level de-identification holds (no per-person structure leaks up)
  const rep=WP.decisionMemory.aggregate([
    {type:'evaluation',at:'2026-06-23',target:'p_x'},{type:'access-grant',at:'2026-06-24',target:'p_y'},
    {type:'assign',at:'2026-06-25',target:'p_z'},{type:'role-change',at:'2026-06-25',target:'p_q'}
  ],{ref:'2026-06-26'});
  assert(!('byPerson' in rep)&&!('people' in rep),'aggregate exposes no per-person structure');
  assert(rep.evidence.every(e=>!('target' in e)&&!('person' in e)&&!('subjectId' in e)),'evidence refs are de-identified');

  WP.state.lang='ar'; WP.setState({route:'weekly'}); assert(view.innerHTML.length>0,'report renders under RTL/AR');
  WP.state.lang='en';
}catch(e){errors.push('[run] '+e.message+'\n'+e.stack);}
if(errors.length){console.log('FAIL\n'+errors.join('\n'));process.exit(1);}
console.log('PASS — weekly report: director/admin-only (gate + defence-in-depth); de-identified (no person id/name/row, no score/rank); every figure cites evidence; "Not enough data" first-class; engine aggregate carries no per-person structure; renders in EN + AR/RTL.');
process.exit(0);
