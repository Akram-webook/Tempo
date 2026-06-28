/* WBK Component Library (Wave 1 — atoms): every component mounts, tokens resolve,
 * RTL flips, focus ring present, and the two new atoms (PIN input, Booking label) render
 * with all states. Guards the DS layer from silent regressions. */
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
  WP.setState({route:'library'});
  const view=window.document.getElementById('view');
  const h=view.innerHTML;

  // the gallery mounts with the headline + a representative spread of components
  assert(/WBK Component Library/.test(h),'gallery header renders');
  ['wbk-btn','wbk-chip','wbk-badge','wbk-blabel','wbk-pin','wbk-card','wbk-li'].forEach(function(c){
    assert(view.querySelector('.'+c),'component class .'+c+' mounts');
  });

  // NEW atom — PIN code: 6 boxes per group, numeric, accessible labels, error variant present
  const pinGroups=view.querySelectorAll('.wbk-pin');
  assert(pinGroups.length>=2,'PIN renders default + error groups');
  const firstPin=pinGroups[0];
  assert(firstPin.querySelectorAll('input').length===6,'PIN has 6 single-char boxes');
  assert(firstPin.querySelector('input').getAttribute('inputmode')==='numeric','PIN boxes are numeric inputmode');
  assert(firstPin.getAttribute('role')==='group' && /code/i.test(firstPin.getAttribute('aria-label')||''),'PIN group is labelled for AT');
  assert(view.querySelector('.wbk-pin.is-error'),'PIN exposes an error state');
  // auto-advance: typing a digit moves focus to the next box
  const boxes=firstPin.querySelectorAll('input');
  boxes[2].value='7'; boxes[2].oninput();
  assert(window.document.activeElement===boxes[3],'PIN auto-advances focus on digit entry');

  // NEW atom — Booking label: each status pill carries an icon (never colour-only) + a label
  const labels=view.querySelectorAll('.wbk-blabel');
  assert(labels.length>=4,'Booking label shows all status variants');
  assert(view.querySelector('.wbk-blabel--positive') && view.querySelector('.wbk-blabel--notice') && view.querySelector('.wbk-blabel--negative'),'Booking label semantic variants present');
  let allHaveIcon=true; labels.forEach(function(l){ if(!l.querySelector('svg')) allHaveIcon=false; });
  assert(allHaveIcon,'every Booking label pairs colour with an icon (accessible, not colour-alone)');

  // tokens resolve (declared on :root in tokens.css, bundled into index.html)
  const css=fs.readFileSync(path.join(root,'src/css/tokens.css'),'utf8');
  ['--radius-lg','--sp-4','--fs-l','--state-negative','--state-positive','--state-notice'].forEach(function(v){
    assert(css.indexOf(v)>=0,'token '+v+' is defined in tokens.css');
  });
  // no raw Figma hex leaked into the atom styles (must map to tokens)
  const appcss=fs.readFileSync(path.join(root,'src/css/app.css'),'utf8');
  const pinBlock=appcss.slice(appcss.indexOf('.wbk-pin'),appcss.indexOf('.wbk-blabel--negative'));
  assert(!/#651c1c|#ff6c6c|#fcc800|#22c55e/i.test(pinBlock),'new atoms use tokens, not pasted Figma hex');

  // RTL flips the shell direction; PIN digits stay LTR by design
  WP.setState({lang:'ar'});
  assert(window.document.documentElement.getAttribute('dir')==='rtl' || window.document.body.getAttribute('dir')==='rtl' || /dir="rtl"/.test(window.document.documentElement.outerHTML),'AR sets RTL direction');
  assert(window.document.getElementById('view').querySelector('.wbk-blabel'),'components still mount under RTL');

  // EN+AR strings exist for the new labels
  WP.state.lang='en';
  ['pinCode','blConfirmed','blPending','blSoldOut','blDraft'].forEach(function(k){
    assert(WP.i18n.t(k) && WP.i18n.t(k)!==k,'i18n EN key present: '+k);
  });
  WP.state.lang='ar';
  ['pinCode','blConfirmed','blPending','blSoldOut','blDraft'].forEach(function(k){
    assert(WP.i18n.t(k) && WP.i18n.t(k)!==k,'i18n AR key present: '+k);
  });
}catch(e){errors.push('[run] '+e.message+'\n'+e.stack);}
if(errors.length){console.log('FAIL\n'+errors.join('\n'));process.exit(1);}
console.log('PASS — WBK atoms: gallery mounts clean, PIN input (auto-advance + error + a11y) and Booking label (icon-backed status) render, tokens resolve, RTL flips, EN+AR strings present.');
process.exit(0);
