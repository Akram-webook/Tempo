/* Verified sign-in: with Supabase configured, login emails a one-time LINK to the
 * REAL mailbox; a returning session is mapped to the matching Tempo account (deny if
 * unknown / no access). Directory correctness, super admin, and new accounts also checked.
 * Supabase client is mocked — no network. */
const fs=require('fs'),path=require('path');const {JSDOM}=require('jsdom');
const root=path.join(__dirname,'..');const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const srcs=[...html.matchAll(/src="([^"]+\.js)"/g)].map(m=>m[1]);
const shellBody=(html.match(/<body[^>]*>([\s\S]*?)<\/body>/)||[,''])[1].replace(/<script[\s\S]*?<\/script>/g,'');
const dom=new JSDOM('<!doctype html><html><body>'+shellBody+'</body></html>',{url:'https://akram-webook.github.io/tempo/',runScripts:'outside-only'});
const {window}=dom;window.HTMLElement.prototype.scrollIntoView=function(){};window.matchMedia=()=>({matches:false,addEventListener(){},removeEventListener(){}});window.setInterval=()=>0;
const errors=[];const benign=/font|stylesheet|localStorage|Security|scrollIntoView|Not implemented|opaque|insertRule|cssRules|gsi|accounts\.google|cdn\.jsdelivr|supabase/i;
['error','warn'].forEach(k=>{const o=window.console[k].bind(window.console);window.console[k]=(...a)=>{const s=a.join(' ');if(!benign.test(s))errors.push('['+k+'] '+s);o(...a);};});
window.addEventListener('error',e=>{if(!benign.test(String(e.message)))errors.push('[onerror] '+e.message);});
for(const s of srcs){try{new window.Function(fs.readFileSync(path.join(root,s),'utf8')).call(window);}catch(e){errors.push('[load '+s+'] '+e.message);}}
const WP=window.WP;function assert(c,m){if(!c)errors.push('[assert] '+m);}
function submitEmail(view,val){view.querySelector('#login-email').value=val;view.querySelector('#login-form').dispatchEvent(new window.Event('submit'));}
try{
  const f=WP.auth.findByEmail;
  assert(f('akram@webook.com').person.id==='p_akram','akram → p_akram');
  assert(f('o.taher.c@webook.com').person.id==='p_osama','o.taher.c → Osama');
  assert(f('fouda@webook.com').person.id==='p_fouda','Fouda account exists');
  assert(f('abdelaal@webook.com').person.id==='p_abdelaal','Abdelaal account exists');
  // Phase A — Motaa Aldarra now has a verified login (was getting errNoAccount).
  assert(f('motaa@webook.com').person.id==='p_motaa','motaa → p_motaa (Phase A login)');
  assert(WP.access.hasAccess('p_motaa')===true,'p_motaa passes the access gate (non-tbc)');
  assert(f('akram@gmail.com').error==='errBadDomain','wrong domain rejected');
  assert(f('nobody@webook.com').error==='errNoAccount','unknown rejected');
  assert(WP.access.isSuperAdmin(WP.access.byId('p_akram'))===true,'akram super admin');
  assert(WP.access.isSuperAdmin(WP.access.byId('p_talal'))===false,'specialist not super admin');

  // Config is wired with real Supabase values → verified-link mode
  assert(WP.config.supabaseUrl && WP.config.supabaseUrl.indexOf('supabase.co')>0,'supabase URL wired');
  assert(WP.config.supabaseAnonKey.indexOf('sb_publishable_')===0,'publishable key wired (public)');
  assert(WP.auth.mode()==='verified-link','mode = verified-link when Supabase configured');

  // Mock the Supabase client so no network is hit
  let sentTo=null; const authCbs=[];
  WP._sb={auth:{
    signInWithOtp:(o)=>{sentTo=o.email;return Promise.resolve({data:{},error:null});},
    onAuthStateChange:(cb)=>{authCbs.push(cb);return {data:{subscription:{unsubscribe(){}}}};},
    getSession:()=>Promise.resolve({data:{session:null}}),
    signOut:()=>Promise.resolve({})
  }};

  WP.state.authed=false;const view=window.document.getElementById('view');WP.ui.login.render(view);
  assert(/Email me a sign-in link/.test(view.innerHTML),'step-1 button offers a sign-in link');
  assert(!view.querySelector('.g-accts'),'no pick-anyone list');

  // submit a valid account → emails a link to the REAL mailbox, does NOT sign in yet
  submitEmail(view,'talal.samir.c@webook.com');
  assert(sentTo==='talal.samir.c@webook.com','sign-in link requested for the real mailbox');
  assert(WP.state.authed===false,'not signed in just by submitting an email');

  // simulate the user opening the link → Supabase returns a verified session
  WP.auth.handleSession({user:{email:'talal.samir.c@webook.com'}});
  assert(WP.state.authed===true && WP.state.viewerId==='p_talal','opening the verified link signs the right user in');

  // a session for a NON-account email must NOT sign in
  WP.state.authed=false; WP.state.viewerId=null;
  WP.auth.handleSession({user:{email:'stranger@webook.com'}});
  assert(WP.state.authed===false,'verified session for a non-account email is rejected');
}catch(e){errors.push('[run] '+e.message+'\n'+e.stack);}
if(errors.length){console.log('FAIL\n'+errors.join('\n'));process.exit(1);}
console.log('PASS — verified sign-in link: emails a link to the real mailbox, signs in only when the returning session matches a registered account, rejects strangers; directory + super admin intact.');
process.exit(0);
