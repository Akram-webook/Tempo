/* TEMPORARY sign-in stopgap — directory gate active to unblock everyone while
 * Google (PR #51) waits on the OAuth Client ID. Proves: with config.authMode
 * defaulting to 'directory' the app uses the instant directory gate EVEN THOUGH
 * Supabase is configured (so WP.db data layer stays live), a registered @webook.com
 * email signs straight in with NO email-send / OTP path invoked, unknown/wrong-domain
 * are still rejected, and the provider switch is reversible (→ google when the id lands).
 * jsdom; no network. */
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
try{
  // ── directory gate is active EVEN THOUGH Supabase is configured (decoupled) ──
  assert(WP.config.authMode==='directory','stopgap default authMode = directory');
  assert(WP.config.supabaseUrl && WP.config.supabaseUrl.indexOf('supabase.co')>0,'Supabase URL still configured (WP.db data layer)');
  assert(WP.config.supabaseAnonKey && WP.config.supabaseAnonKey.indexOf('sb_publishable_')===0,'Supabase publishable key still configured');
  assert(WP.auth.mode()==='directory','auth mode resolves to DIRECTORY even with Supabase keys present');

  // ── login screen = the email gate, NO "link sent" copy, no pick-anyone list ──
  WP.state.authed=false;const view=window.document.getElementById('view');WP.ui.login.render(view);
  assert(view.querySelector('#login-email'),'directory gate shows the email field');
  assert(!view.querySelector('.g-accts'),'no pick-anyone list');
  assert(!/linkSentTo|Email me a sign-in link/.test(view.innerHTML),'no email-link copy');

  // ── a registered @webook.com email signs straight in — NO OTP / email-send path ──
  let otpCalled=false;
  WP._sb={auth:{signInWithOtp:function(){otpCalled=true;return Promise.resolve({data:{},error:null});},signOut:function(){return Promise.resolve({});}}};
  view.querySelector('#login-email').value='motaa@webook.com';
  view.querySelector('#login-form').dispatchEvent(new window.Event('submit'));
  assert(WP.state.authed===true && WP.state.viewerId==='p_motaa','registered email signs in directly (motaa → p_motaa)');
  assert(otpCalled===false,'NO email-send / OTP path invoked in directory mode');

  // ── rejections still hold ──
  const f=WP.auth.findByEmail;
  assert(f('nobody@webook.com').error==='errNoAccount','unknown @webook.com rejected');
  assert(f('akram@gmail.com').error==='errBadDomain','wrong domain rejected');
  assert(f('ayman@webook.com').person.id==='p_ayman','another registered email resolves (ayman → p_ayman)');

  // ── both themes + EN/AR still render the gate ──
  WP.state.authed=false;
  WP.state.lang='ar';WP.state.theme='dark';WP.ui.login.render(view);assert(view.querySelector('#login-email'),'gate renders under AR/dark');
  WP.state.lang='en';WP.state.theme='light';WP.ui.login.render(view);assert(view.querySelector('#login-email'),'gate renders under EN/light');

  // ── reversible: flips back to Google (the intended final state) cleanly ──
  WP.config.authMode='google';assert(WP.auth.mode()==='google','authMode flips to google when the Client ID lands');
  WP.config.authMode='verified-link';assert(WP.auth.mode()==='verified-link','authMode flips to verified-link cleanly');
  WP.config.authMode='directory';
}catch(e){errors.push('[run] '+e.message+'\n'+e.stack);}
if(errors.length){console.log('FAIL\n'+errors.join('\n'));process.exit(1);}
console.log('PASS — auth stopgap: directory gate is active while Supabase stays wired for DATA; a registered @webook.com email signs in instantly with NO email-send path; unknown/wrong-domain rejected; EN+AR both themes; reversible to google/verified-link.');
process.exit(0);
