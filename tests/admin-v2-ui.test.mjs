import {createRequire} from 'node:module';
const {JSDOM}=createRequire(import.meta.url)('jsdom');
import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
const section=html.match(/<section id="myeventAdminPanel"[\s\S]*?<\/section>/)?.[0];assert.ok(section);
const dom=new JSDOM('<!doctype html><html><body><div id="profileSettingsCard"><button id="myeventAdminEntry" hidden></button></div>'+section+'</body></html>',{runScripts:'outside-only',url:'https://preview.example.test/'});
const {window}=dom;const doc=window.document;window.HTMLElement.prototype.scrollIntoView=function(){};
const wait=ms=>new Promise(r=>setTimeout(r,ms));const click=selector=>doc.querySelector(selector).click();
let allowed=true,currentId='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',authCallback,confirm=true,errorMode=false,deferred;
window.confirm=()=>confirm;window.prompt=()=> 'Motif détaillé';
const calls=[];let actionResolve;
const data={users:[{id:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',username:'userb',display_name:'Compte B',suspended:false,is_admin:false}],events:[{id:'event',name:'Sortie',visibility:'private',creator_name:'B'}],listings:[{id:'listing',title:'Annonce',price_cents:1200,status:'active'}],reports:[{id:'report',target_kind:'event',target_id:'event',reason:'Un signalement',status:'open'}],partners:[{provider:'viator',label:'Viator',enabled:false,notes:''}],settings:[{key:'music',description:'Musique',enabled:true}],audit:[{id:1,action:'hide',target_kind:'event',detail:{reason:'motif'},actor_id:currentId}]};
window.sb={auth:{getUser:async()=>({data:{user:{id:currentId}}}),onAuthStateChange:fn=>{authCallback=fn;}},rpc:async(name,args)=>{
 calls.push({name,args});
 if(name==='myevent_is_admin')return{data:allowed};
 if(name==='myevent_admin_overview')return{data:{users:2,events:1,suspension_gate_ready:false,generated_at:new Date().toISOString()}};
 if(name==='myevent_admin_list'){if(deferred)return await deferred;if(errorMode)return{error:{message:'Erreur RPC contrôlée'}};return{data:data[args.p_kind]||[]};}
 if(name==='myevent_admin_partner_content_list')return{data:[{id:'content',title:'GetYourGuide',kind:'activity',enabled:true}]};
 if(name==='myevent_admin_action'&&actionResolve)return await new Promise(r=>actionResolve=r);
 return{data:[]};
 }};
window.eval(await readFile(new URL('../js/admin-runtime.js',import.meta.url),'utf8'));
await wait(500);assert.equal(doc.getElementById('myeventAdminEntry').hidden,false);
click('#myeventAdminEntry');await wait(30);assert.equal(doc.getElementById('myeventAdminPanel').hidden,false);
assert.match(doc.getElementById('myeventAdminGate').textContent,/verrouillées/);
for(const tab of ['content','users','events','marketplace','partners','settings']){click('[data-admin-tab='+tab+']');await wait(20);assert.equal(doc.querySelector('[data-admin-tab='+tab+']').getAttribute('aria-current'),'page');assert.equal(doc.querySelector('[data-admin-view='+tab+']').hidden,false);}
assert.equal(doc.querySelectorAll('#myeventAdminAudit .adminCard').length,1);
click('[data-admin-tab=users]');await wait(20);
const search=doc.querySelector('[data-admin-search=users]');search.value='Compte B';search.dispatchEvent(new window.Event('input'));await wait(290);assert.ok(calls.some(c=>c.name==='myevent_admin_list'&&c.args.p_query==='Compte B'));
confirm=false;let count=calls.filter(c=>c.name==='myevent_admin_action').length;click('#myeventAdminUsers .adminDanger');await wait(20);assert.equal(calls.filter(c=>c.name==='myevent_admin_action').length,count);
confirm=true;actionResolve=true;click('#myeventAdminUsers .adminDanger');await wait(20);assert.equal(doc.querySelector('#myeventAdminUsers .adminDanger').disabled,true);
click('#myeventAdminUsers .adminDanger');await wait(20);assert.equal(calls.filter(c=>c.name==='myevent_admin_action').length,count+1);
actionResolve({data:null});actionResolve=null;await wait(30);assert.match(doc.getElementById('myeventAdminMessage').textContent,/journal/);
errorMode=true;click('[data-admin-tab=events]');await wait(20);assert.equal(doc.getElementById('myeventAdminMessage').dataset.state,'error');assert.match(doc.getElementById('myeventAdminEventReports').textContent,/indisponibles/);
errorMode=false;click('[data-admin-tab=events]');await wait(20);assert.equal(doc.getElementById('myeventAdminMessage').dataset.state,'success');
// A delayed admin request must not display its data after account switch.
let resolveDeferred;deferred=new Promise(r=>resolveDeferred=r);click('[data-admin-tab=users]');await wait(20);
allowed=false;currentId='cccccccc-cccc-4ccc-8ccc-cccccccccccc';authCallback();await wait(20);resolveDeferred({data:data.users});deferred=null;await wait(20);
assert.equal(doc.getElementById('myeventAdminPanel').hidden,true);assert.equal(doc.getElementById('myeventAdminEntry').hidden,true);assert.equal(doc.getElementById('myeventAdminUsers').childElementCount,0);
// Returning to the Profile recovers a permission check after installation,
// without granting access from client identity fields.
allowed=true;doc.getElementById('profileSettingsCard').classList.add('profileSettingsVisible');await wait(30);
assert.equal(doc.getElementById('myeventAdminEntry').hidden,false);assert.equal(doc.getElementById('myeventAdminPanel').hidden,true);
allowed=false;window.dispatchEvent(new window.Event('pageshow'));await wait(30);assert.equal(doc.getElementById('myeventAdminEntry').hidden,true);
window.close();console.log('Admin V2.1 UI: all 7 tabs, search, cancellation, duplicate protection, errors, audit, session-race and Profile/pageshow rechecks OK');
