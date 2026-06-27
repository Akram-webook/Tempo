/* Finder team rows ("Led by", lead avatar) + mandatory evaluation banner behavior. */
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
try{
  WP.state.authed=true;WP.state.lang='en';
  // a manager with reports → land on dashboard via full app render → mandatory banner shows
  const mgr=WP.data.PEOPLE.find(p=>WP.access.directReports(p.id).length>0 && WP.data.EVALUATIONS);
  WP.state.viewerId=mgr.id; WP.state.route='dashboard'; WP.render();
  const req=WP.evaluation.requiredFor(mgr.id);
  const banner=window.document.getElementById('eval-banner');
  if(req.pending>0){
    assert(banner && !banner.hidden && /Review now/.test(banner.textContent),'mandatory banner shows for a manager with pending reviews ('+mgr.name+')');
    assert(/reviews due/.test(banner.textContent),'banner names the cycle + reviews due');
  }
  // navigate to another page → banner persists (lives above #view)
  WP.state.route='daily'; WP.render();
  if(req.pending>0) assert(!window.document.getElementById('eval-banner').hidden,'banner persists after navigating to another page');
  // due info present + active cycle is the quarterly one
  const di=WP.evaluation.dueInfo(); assert(di && di.cycle && di.cycle.status==='Active','active cycle has a due date');

  // S3-3 + S3-2: dashboard frames team health as a band split and shows the Sample data badge
  WP.setState({route:'dashboard'});
  const dashHtml=window.document.getElementById('view').innerHTML;
  assert(/Sample data/.test(dashHtml),'S3-2 — dashboard shows the "Sample data" honesty badge');
  assert(/in healthy band/.test(dashHtml),'S3-3 — team health reads as "{h} of {n} in healthy band", not a bare alarm %');

  // S3-1 + S4-1: open a report's evaluation from the Evaluations hub
  const rep=WP.access.directReports(mgr.id)[0];
  const active=WP.evaluation.activeCycle();
  WP.setState({route:'evaluation',selectedId:rep.id,selectedCycle:active.id,evalOrigin:'evaluations'});
  const head=window.document.querySelector('#view .eval-head');
  assert(head && head.textContent.indexOf(active.name)>=0,'S3-1 — evaluation header shows the ACTIVE cycle ('+active.name+'), not a stale period');
  assert(head && head.textContent.indexOf('2025 Mid-Year')<0,'S3-1 — stale "2025 Mid-Year" period no longer leaks into the active-cycle evaluation');
  const backEval=window.document.getElementById('back');
  assert(backEval && /Back to evaluations/.test(backEval.textContent),'S4-1 — back button says "Back to evaluations" when opened from the hub');

  // S4-1: same evaluation opened from a profile → "Back to profile"
  WP.setState({route:'evaluation',selectedId:rep.id,evalOrigin:'profile'});
  const backProf=window.document.getElementById('back');
  assert(backProf && /Back to profile/.test(backProf.textContent),'S4-1 — back button says "Back to profile" when opened from a profile');
  // finder team rows: render map, focus finder, check team rows say "Led by" and use avatars
  WP.state.route='map'; WP.render();
  const input=window.document.querySelector('#map-search'); input.value=''; input.onfocus();
  const dd=window.document.querySelector('#map-suggest');
  const teamRow=dd.querySelector('.pr-team');
  assert(teamRow,'finder lists team rows');
  if(teamRow){ assert(/Led by/.test(teamRow.textContent),'team row shows "Led by <lead>"');
    assert(teamRow.querySelector('.avatar'),'team row uses the lead avatar (photo/initials), not a generic icon');
    assert(/View team/.test(teamRow.textContent),'team row has a View team action'); }
}catch(e){errors.push('[run] '+e.message+'\n'+e.stack);}
if(errors.length){console.log('FAIL\n'+errors.join('\n'));process.exit(1);}
console.log('PASS — finder team rows (Led by + avatar + View team) and the mandatory, persistent evaluation banner all work.');
process.exit(0);
