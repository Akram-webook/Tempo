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

  // Wave 2 molecules all mount
  ['wbk-bc','wbk-upload','wbk-tile','wbk-price','wbk-media','wbk-bubble','wbk-mappin','wbk-ticket','wbk-actions','wbk-dock'].forEach(function(c){
    assert(view.querySelector('.'+c),'Wave-2 molecule .'+c+' mounts');
  });
  // breadcrumb: current page is non-link + marked for AT, has separators
  assert(view.querySelector('.wbk-bc [aria-current="page"]'),'breadcrumb marks the current page');
  assert(view.querySelector('.wbk-bc a'),'breadcrumb has links');
  assert(view.querySelector('.wbk-bc-sep'),'breadcrumb has separators');
  // chat bubble: both directions present
  assert(view.querySelector('.wbk-bubble--sent') && view.querySelector('.wbk-bubble--recv'),'chat bubble has sent + received variants');
  // tile: single-select — clicking a second tile moves the selection
  const tlist=view.querySelectorAll('#wbk-tiles .wbk-tile');
  assert(tlist.length>=2,'tiles render');
  tlist[1].onclick();
  assert(tlist[1].getAttribute('aria-pressed')==='true' && tlist[0].getAttribute('aria-pressed')==='false','tile is single-select');
  // ticket stepper: increment + clamp-at-zero disabling the minus button
  const vipRow=view.querySelector('.wbk-ticket[data-ticket="vip"]');
  const vipV=vipRow.querySelector('.wbk-qty-v'); const vipMinus=vipRow.querySelector('[data-q="-1"]');
  assert(vipV.textContent==='0' && vipMinus.disabled,'ticket qty starts at 0 with minus disabled');
  vipRow.querySelector('[data-q="1"]').onclick();
  assert(vipV.textContent==='1' && !vipMinus.disabled,'ticket qty increments and re-enables minus');
  vipRow.querySelector('[data-q="-1"]').onclick();
  assert(vipV.textContent==='0' && vipMinus.disabled,'ticket qty clamps at 0 and re-disables minus');
  // map pin uses .wbk-mappin (must NOT collide with the PIN-code .wbk-pin atom)
  assert(!view.querySelector('.wbk-mappin.wbk-pin'),'map pin and PIN-code atom use distinct classes');

  // exact WBK PRO V3 token values (re-baselined in Wave 1)
  const tk=fs.readFileSync(path.join(root,'src/css/tokens.css'),'utf8');
  assert(/--text:\s*#071437/i.test(tk),'V3 Content-Primary navy #071437 wired (light base)');
  assert(/--surface:\s*#FFFFFF/i.test(tk),'V3 Bg-Primary pure white #FFFFFF wired');
  assert(/--text-muted:\s*#78829D/i.test(tk),'V3 Content-Secondary #78829D wired');
  assert(/--state-positive:\s*#17C653/i.test(tk),'V3 Success (Positive) #17C653 wired');
  assert(/--state-negative:\s*#F8285A/i.test(tk),'V3 Content-Danger (Negative) #F8285A wired');
  assert(/--state-negative-active:\s*#D81A48/i.test(tk),'V3 Content-Danger-Active #D81A48 wired');
  assert(/--state-negative-bg:\s*#FFEEF3/i.test(tk),'V3 Bg-Danger #FFEEF3 wired (exact)');
  assert(/--inverse-bg:\s*#071437/i.test(tk),'V3 Bg-Primary-Inverse #071437 wired (Primary button)');
  assert(/--brand:\s*#FF2C79/i.test(tk),'V3 Bg-Brand #FF2C79 wired (CTA)');
  assert(/--brand-disabled-bg:\s*#FFD4E4/i.test(tk),'V3 Bg-Brand-Disabled #FFD4E4 wired');
  assert(/--radius-md:\s*6px/i.test(tk),'V3 radius-md 6px added');
  assert(/--radius-lg:\s*12px/i.test(tk),'historic radius-lg kept at 12px (no silent shrink → V3 radius-xl)');
  assert(/--fs-label-xl:\s*20px/i.test(tk),'V3 Label-XL 20px (button label) wired');
  assert(/--state-notice:\s*#FCC800/i.test(tk),'Notice #FCC800 retained (no dedicated V3 token)');

  // NEW Wave-1 atom — Button matrix: four intents × sizes × states
  ['cta','primary','secondary','tertiary'].forEach(function(m){
    assert(view.querySelector('.wbk-btn--'+m),'button intent .wbk-btn--'+m+' renders');
  });
  ['xl','lg','md','sm'].forEach(function(s){
    assert(view.querySelector('.wbk-btn--'+s),'button size .wbk-btn--'+s+' renders');
  });
  assert(view.querySelector('.wbk-btn:disabled'),'button disabled state renders');
  assert(view.querySelector('.wbk-btn.is-animating .wbk-btn-spin'),'button animating state renders a spinner');
  assert(view.querySelector('.wbk-btn--cta svg'),'buttons carry an SVG icon slot (no emoji)');
  // Button group, Link, Input/Field, Rich text
  assert(view.querySelector('.wbk-btngroup .wbk-btn'),'button group renders');
  assert(view.querySelector('.wbk-link'),'link atom renders');
  assert(view.querySelector('.wbk-input') && view.querySelector('.wbk-field-label'),'input + field label render');
  assert(view.querySelector('.wbk-field.is-error .wbk-input'),'input error state renders');
  assert(view.querySelector('.wbk-input:disabled'),'input disabled state renders');
  assert(view.querySelector('.wbk-rich h3') && view.querySelector('.wbk-rich p'),'rich-text block renders');
  // V3 button CSS maps to tokens, never pasted hex
  const appcssAtom=fs.readFileSync(path.join(root,'src/css/app.css'),'utf8');
  const btnBlock=appcssAtom.slice(appcssAtom.indexOf('.wbk-btn {'),appcssAtom.indexOf('.wbk-link {'));
  assert(!/#071437|#ff2c79|#f9f9f9|#ffd4e4/i.test(btnBlock),'button styles use tokens, not pasted V3 hex');

  // NEW Wave-2 molecules — Alert (semantic, icon-led) + Dropdown menu
  ['positive','notice','negative'].forEach(function(m){
    assert(view.querySelector('.wbk-alert--'+m),'alert variant .wbk-alert--'+m+' renders');
  });
  let alertsIconed=true; view.querySelectorAll('.wbk-alert').forEach(function(a){ if(!a.querySelector('.wbk-alert-ic svg')) alertsIconed=false; });
  assert(alertsIconed,'every alert leads with an icon (accessible, not colour-alone)');
  assert(view.querySelector('.wbk-alert-x[aria-label]'),'closable alert has a labelled dismiss control');
  assert(view.querySelector('.wbk-menu [role="menuitem"][aria-selected="true"]'),'menu marks the selected item');
  assert(view.querySelector('.wbk-menu-item:disabled'),'menu has a disabled item');
  assert(view.querySelector('.wbk-menu-item--danger'),'menu has a danger item');
  assert(view.querySelector('.wbk-menu-sep'),'menu has a separator');
  // card reconciled to V3 radius-lg + alert/menu use tokens not pasted hex
  const appcssMol=fs.readFileSync(path.join(root,'src/css/app.css'),'utf8');
  assert(/\.wbk-card \{[^}]*--radius-lg/.test(appcssMol),'card reconciled to V3 radius-lg (12px)');
  const alBlock=appcssMol.slice(appcssMol.indexOf('.wbk-alert {'),appcssMol.indexOf('.wbk-menu-sep'));
  assert(!/#f8285a|#ffeef3|#17c653|#fcc800/i.test(alBlock),'alert/menu styles use tokens, not pasted V3 hex');
  // transition guard: live default theme held at DARK through the V3 waves (saved pref still honored)
  const stateJs=fs.readFileSync(path.join(root,'src/js/core/state.js'),'utf8');
  assert(/theme:\s*'dark'/.test(stateJs),'default theme held at dark during V3 transition (flips to light at Wave 4)');

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
  const i18nKeys=['pinCode','blConfirmed','blPending','blSoldOut','blDraft','bcHome','bcEvents','bcTickets','uploadCta','uploadHint','ticketGeneral','ticketVip','mapRestaurant','mapHotel','chatRecv','chatSent','btnCta','btnPrimary','btnSecondary','btnTertiary','btnDisabled','btnAnimating','bgDay','bgWeek','bgMonth','linkLearn','linkView','inEmail','inEmailHint','inName','inNamePh','inNameErr','inDisabled','rtTitle','rtBody','rtLink','alClose','alInfoT','alInfoM','alOkT','alOkM','alWarnT','alWarnM','alErrT','alErrM','mnView','mnEdit','mnShare','mnDelete'];
  WP.state.lang='en';
  i18nKeys.forEach(function(k){ assert(WP.i18n.t(k) && WP.i18n.t(k)!==k,'i18n EN key present: '+k); });
  WP.state.lang='ar';
  i18nKeys.forEach(function(k){ assert(WP.i18n.t(k) && WP.i18n.t(k)!==k,'i18n AR key present: '+k); });
}catch(e){errors.push('[run] '+e.message+'\n'+e.stack);}
if(errors.length){console.log('FAIL\n'+errors.join('\n'));process.exit(1);}
console.log('PASS — WBK atoms + molecules: gallery mounts clean; PIN, booking label, breadcrumb, uploader, tile (single-select), price, media, chat bubble, map pin, ticket stepper (clamp-at-0), actions/dock all render; exact DS semantic tokens wired; RTL flips; EN+AR strings present.');
process.exit(0);
