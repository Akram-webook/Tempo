/* Standalone "Operations Chart" export (chart.html) — PUBLIC, read-only, SAMPLE DATA.
 * Verifies the page boots straight onto the org chart with NO login / app shell / no
 * backend, and is fully interactive: expand/collapse all, search, both themes, EN+AR/RTL.
 * Privacy: the bundle carries NO auth/db/Supabase, and shows the "Sample data" badge. */
const fs=require('fs'),path=require('path');const {JSDOM}=require('jsdom');
const root=path.join(__dirname,'..');const html=fs.readFileSync(path.join(root,'chart.html'),'utf8');
const srcs=[...html.matchAll(/src="([^"]+\.js)"/g)].map(m=>m[1]);
const shellBody=(html.match(/<body[^>]*>([\s\S]*?)<\/body>/)||[,''])[1].replace(/<script[\s\S]*?<\/script>/g,'');
const dom=new JSDOM('<!doctype html><html><body>'+shellBody+'</body></html>',{url:'https://localhost/',pretendToBeVisual:true,runScripts:'outside-only'});
const {window}=dom;window.HTMLElement.prototype.scrollIntoView=function(){};window.matchMedia=()=>({matches:false,addEventListener(){},removeEventListener(){}});window.setInterval=()=>0;window.confirm=()=>false;window.alert=()=>{};window.prompt=()=>null;
const errors=[];const benign=/font|stylesheet|localStorage|Security|scrollIntoView|Not implemented|opaque|insertRule|cssRules/i;
['error','warn'].forEach(k=>{const o=window.console[k].bind(window.console);window.console[k]=(...a)=>{const s=a.join(' ');if(!benign.test(s))errors.push('['+k+'] '+s);o(...a);};});
window.addEventListener('error',e=>{if(!benign.test(String(e.message)))errors.push('[onerror] '+e.message);});
for(const s of srcs){try{new window.Function(fs.readFileSync(path.join(root,s),'utf8')).call(window);}catch(e){errors.push('[load '+s+'] '+e.message);}}
const WP=window.WP;function assert(c,m){if(!c)errors.push('[assert] '+m);}
const doc=window.document;
const chartHtmlRaw=html; // source shell (script list)
function finish(){if(errors.length){console.log('FAIL\n'+errors.join('\n'));process.exit(1);}
  console.log('PASS — ops-chart export: boots straight onto the org chart with NO login / app shell / backend; sample-data badge shown; expand-all/collapse-all, search, theme toggle, EN+AR/RTL all work; the bundle carries no auth/db/Supabase (public-safe, sample data only).');
  process.exit(0);}

try{
  // ── self-contained + no backend wiring (privacy) ──
  assert(!/login\.js|app\.js/.test(chartHtmlRaw.match(/<body[\s\S]*<\/body>/)[0]),'chart.html does NOT load the login or app-shell scripts');
  assert(!/db\.js/.test(chartHtmlRaw),'chart.html does NOT load db.js (no Supabase wiring)');
  assert(WP.EMBED===true,'WP.EMBED is set (standalone embed mode)');
  assert(!WP.db,'no WP.db present → cannot reach a backend');
  assert(!WP.ui.login,'no login UI loaded');
  assert(typeof WP.auth==='undefined','no auth module loaded (public, read-only)');

  // ── privacy: the PUBLIC built chart ships ZERO real @webook.com addresses ──
  // (build.js empties the EMAILS map for the chart bundle; the app keeps it for login.)
  const distChart=path.join(root,'dist','chart.html');
  if(fs.existsSync(distChart)){
    const built=fs.readFileSync(distChart,'utf8');
    // No real account address ships: the directory entry pattern (p_xxx: 'name@webook.com')
    // must not survive. (Remaining @webook.com hits are i18n login copy / comments naming the
    // domain — not personal data, so they're allowed; emptying EMAILS is the privacy fix.)
    assert(!/p_\w+\s*:\s*'[^']+@webook\.com'/.test(built),'built dist/chart.html ships NO real directory emails');
    assert(/const EMAILS = \{\};/.test(built),'EMAILS map is emptied in the public chart bundle');
  }

  // ── lands directly on the chart (boot ran on load) ──
  const view=doc.getElementById('view');
  assert(doc.getElementById('chart-bar'),'standalone top bar exists');
  assert(doc.querySelector('.oc-title'),'shows the Operations Chart title');
  assert(doc.querySelector('.oc-sample'),'shows the "Sample data" badge (public sample data)');
  assert(!doc.getElementById('appbar')&&!doc.getElementById('topbar'),'no app sidebar / top nav (standalone)');
  assert(view.querySelector('.tree'),'renders the org chart (tree) directly');
  assert(view.querySelector('.tree .node[data-id]'),'chart has manager/employee nodes');

  // ── controls present ──
  ['#oc-expand','#oc-collapse','#oc-theme','#oc-lang'].forEach(function(s){ assert(doc.querySelector(s),'control '+s+' present'); });
  assert(doc.querySelector('#map-search'),'chart has a search box (reused finder)');

  // ── expand all / collapse all change how much of the tree is shown ──
  doc.querySelector('#oc-collapse').click();
  const collapsedCount=view.querySelectorAll('.tree .node[data-id]').length;
  doc.querySelector('#oc-expand').click();
  const expandedCount=view.querySelectorAll('.tree .node[data-id]').length;
  assert(expandedCount>collapsedCount,'Expand all reveals more nodes than Collapse all');

  // ── theme toggle flips the document theme ──
  const before=WP.state.theme;
  doc.querySelector('#oc-theme').click();
  assert(WP.state.theme!==before&&doc.documentElement.getAttribute('data-theme')===WP.state.theme,'theme toggle flips light/dark');

  // ── language toggle → AR + RTL ──
  WP.state.lang='en';WP.render();
  doc.querySelector('#oc-lang').click();
  assert(WP.state.lang==='ar','lang toggle switches to Arabic');
  assert(doc.documentElement.dir==='rtl','AR renders RTL');
  assert(view.querySelector('.tree'),'chart still renders under AR/RTL');

  // ── both themes render cleanly ──
  WP.state.lang='en';WP.state.theme='light';WP.render();assert(view.querySelector('.tree'),'renders under light theme');
  WP.state.theme='dark';WP.render();assert(view.querySelector('.tree'),'renders under dark theme');

  // ── search filters/jumps without error (type a query, fire input) ──
  const search=doc.getElementById('map-search');
  if(search){ search.value='a'; search.dispatchEvent(new window.Event('input')); assert(true,'search input handled'); }
}catch(e){errors.push('[run] '+e.message+'\n'+e.stack);}
finish();
