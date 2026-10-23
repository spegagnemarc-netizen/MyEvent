import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';
import {JSDOM} from 'jsdom';
const root=fileURLToPath(new URL('../',import.meta.url));
const read=file=>readFileSync(path.join(root,file),'utf8');
const git=(...args)=>execFileSync('git',args,{cwd:root,encoding:'utf8',maxBuffer:2*1024*1024}).trim();
const audit=JSON.parse(read('docs/consolidation/audit-20261024.json'));
const intentional=['index.html','marketplace.html','css/section-navigation.css','css/explorer.css','vercel.json'];
test('all Production files and every main-specific change are retained; only five reviewed files differ from Production',()=>{
 for(const file of Object.keys(audit.productionFiles)){
  assert(existsSync(path.join(root,file)),'Missing Production file: '+file);
 }
 // Compare the stored Git form for files that use checkout line ending conversion.
 const actual=git('diff','--name-only',audit.production,'--',...Object.keys(audit.productionFiles)).split('\n').filter(Boolean);
 assert.deepEqual(actual.sort(),[...intentional].sort());
 for(const file of audit.mainOnly)assert.equal(git('hash-object','--path='+file,file),audit.mainFiles[file]);
 const baseFiles=Object.fromEntries(git('ls-tree','-r',audit.base).split('\n').map(line=>{const [meta,file]=line.split('\t');return[file,meta.split(' ')[2]];}));
 for(const [file,blob]of Object.entries(audit.mainFiles))if(blob!==baseFiles[file])assert.equal(git('hash-object','--path='+file,file),blob,'Lost main change: '+file);
 assert.equal(git('merge-base',audit.main,'HEAD'),audit.main);
});
test('design palette is exact without duplicate metallic rules; existing profile layout and Explorer rules survive',()=>{
 const source=git('show',audit.design+':css/section-colors.css');
 assert.equal(read('css/section-colors.css').trim(),source.split('/* Les trois ID priment')[0].trim());
 const inline=read('css/inline-extracted.css');
 assert.equal((inline.match(/--ov-metal-base:#57401b/g)||[]).length,1);
 assert.equal((inline.match(/--ov-metal-base:#45515f/g)||[]).length,1);
 assert.match(inline,/box-shadow:inset 0 0 14px 2px var\(--ov-metal-light\),inset 0 1px 0 var\(--ov-from\)!important/);
 const nav=read('css/section-navigation.css');
 assert.match(nav,/^@import url\("\.\/section-colors\.css/);
 assert.equal(nav.slice(nav.indexOf('\n')+1).replace(/\r\n/g,'\n').trim(),git('show',audit.production+':css/section-navigation.css').replace(/\r\n/g,'\n').trim());
 assert.match(nav,/#profileSettingsCard \.meProfileActions>#logoutBtn/);
 assert(read('css/explorer.css').startsWith(git('show',audit.production+':css/explorer.css')));
});
test('canonical legal pages, public aliases and auth/profile links resolve without duplicate pages',()=>{
 const config=JSON.parse(read('vercel.json'));
 for(const [url,dest]of [['/suppression-compte','/delete-account.html'],['/suppression-compte/','/delete-account.html'],['/suppression-compte.html','/delete-account.html'],['/confidentialite','/privacy.html'],['/politique-de-confidentialite/','/privacy.html'],['/politique-de-confidentialite.html','/privacy.html']]){
  const route=config.routes.find(route=>route.src&&new RegExp(route.src).test(url));assert.equal(route?.dest,dest);assert(existsSync(path.join(root,dest)));
 }
 for(const file of ['privacy.html','delete-account.html']){
  const dom=new JSDOM(read(file));
  for(const a of dom.window.document.querySelectorAll('a[href]')){const href=a.getAttribute('href');if(!/^(https?:|mailto:|#)/.test(href))assert(existsSync(path.join(root,href)),file+' → '+href);}
  dom.window.close();
 }
 const dom=new JSDOM(read('index.html'));
 assert.equal(dom.window.document.querySelectorAll('#auth a[href="privacy.html"]').length,1);
 assert.equal(dom.window.document.querySelectorAll('#auth a[href="delete-account.html"]').length,1);
 assert.equal(dom.window.document.querySelectorAll('#profileSettingsCard a[href="privacy.html"]').length,1);
 dom.window.close();
 assert.match(read('privacy.html'),/Projet à valider avant publication/);
 assert.match(read('delete-account.html'),/ne supprime aucune donnée automatiquement/);
});
test('recovery redirect from 497e426 runs before main auth without touching a real account',async()=>{
 const html=read('index.html');assert(html.indexOf('js/section-navigation.js')<html.indexOf('@supabase/supabase-js'));
 let target;const window={};const location={origin:'https://fixture.invalid',search:'',hash:'#type=recovery&expires_in=3600',replace:value=>{target=new URL(value);}};
 vm.runInNewContext(read('js/section-navigation.js'),{window,location,URL,URLSearchParams});
 assert.equal(target.pathname,'/reset-password.html');assert.equal(target.hash,location.hash);assert.equal(window.myeventRecoveryRedirecting,true);
 const core=read('js/core-runtime.js');const connect=core.slice(core.indexOf('async function connect(){'),core.indexOf('\nasync function signup(){'));
 const context=vm.createContext({window});vm.runInContext(connect,context);await context.connect();
});
test('Ticketmaster and TicketNetwork stay unique, with unchanged server code, widgets and route protections',()=>{
 for(const file of ['index.html','explorer-partners-ticket.html']){
  const current=new JSDOM(read(file)),before=new JSDOM(git('show',audit.production+':'+file));
  const doc=current.window.document;assert.equal(doc.querySelectorAll('#ticketmasterDiscovery').length,1);
  assert.equal(doc.querySelectorAll('script[src="js/ticketmaster-discovery.js"]').length,1);
  assert.equal(doc.querySelectorAll('.tnSearchWidget').length,1);
  assert.equal(doc.querySelector('.tnSearchWidget').outerHTML,before.window.document.querySelector('.tnSearchWidget').outerHTML);
  const ids=[...doc.querySelectorAll('[id]')].map(el=>el.id);assert.equal(new Set(ids).size,ids.length,'Duplicate ID in '+file);
  current.window.close();before.window.close();
 }
 for(const file of ['server/search-ticketmaster.js','js/ticketmaster-discovery.js','api/[search].js'])assert.equal(git('hash-object','--path='+file,file),audit.productionFiles[file]);
 const config=JSON.parse(read('vercel.json')),before=JSON.parse(git('show',audit.production+':vercel.json'));
 assert.deepEqual(config.functions,before.functions);
 for(const route of before.routes)if(route.src!=='^/suppression-compte$')assert(config.routes.some(value=>JSON.stringify(value)===JSON.stringify(route)));
 assert.equal(config.git.deploymentEnabled['consolidation/orevami-priorites-20261024'],false);
 assert.equal(Object.keys(config.git.deploymentEnabled).length,1);
});
