import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {createRequire} from 'node:module';
import {JSDOM} from 'jsdom';
import {createAccountDeletionHandler} from '../server/account-deletion-request.mjs';
const require=createRequire(import.meta.url),read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const uid='11111111-1111-4111-8111-111111111111',rid='22222222-2222-4222-8222-222222222222';
const body={confirmation:'SUPPRIMER MON COMPTE',requestId:rid};
const env={VERCEL_ENV:'production',ACCOUNT_DELETION_ENABLED:'true',ACCOUNT_DELETION_SMTP_PASSWORD:'fixture-secret-never-returned'};
const user={id:uid,email:'fixture@example.invalid',email_confirmed_at:'2026-10-01'};
function fixture(overrides={}){const calls={auth:[],mail:[]};const handler=createAccountDeletionHandler({env,
 runtime:()=>({url:'https://fixture.invalid',publishableKey:'sb_publishable_fixture'}),
 fetcher:async(url,options)=>{calls.auth.push({url,options});return {ok:true,json:async()=>user};},
 sendMail:async message=>{calls.mail.push(message);return{accepted:['contact@orevami.com'],rejected:[]};},...overrides});return{handler,calls};}
async function request(handler,overrides={}){const result={headers:{},status:200};await handler({method:'POST',url:'/api/account-deletion',headers:{origin:'https://orevami.com','content-type':'application/json',authorization:'Bearer fixture-valid-token'},body,...overrides},
 {setHeader(k,v){result.headers[k]=v;},status(n){result.status=n;return this;},json(v){result.body=v;}});return result;}
test('unconfigured channel is explicit and cannot claim receipt or call a provider',async()=>{
 const f=fixture({env:{}});const state=await request(f.handler,{method:'GET'});assert.deepEqual(state.body,{requestChannelConfigured:false,automaticDeletion:false});
 assert.equal((await request(f.handler)).status,503);assert.equal(f.calls.auth.length,0);assert.equal(f.calls.mail.length,0);
 const routed=await request(require('../api/[search].js'),{method:'GET'});assert.equal(routed.status,200);assert.equal(routed.body.automaticDeletion,false);
});
test('origin, media type, explicit confirmation and caller-supplied target are checked before auth or SMTP',async()=>{
 for(const [overrides,status]of [[{method:'DELETE'},405],[{headers:{origin:'https://evil.invalid','content-type':'application/json'}},403],[{headers:{origin:'https://orevami.com','content-type':'text/plain'}},415],[{body:{...body,userId:uid}},400],[{body:{...body,confirmation:false}},400],[{headers:{origin:'https://orevami.com','content-type':'application/json'}},401]]){
  const f=fixture();assert.equal((await request(f.handler,overrides)).status,status);assert.equal(f.calls.mail.length,0);assert.equal(f.calls.auth.length,0);
 }
});
test('only the server-verified account is transmitted; acceptance is not deletion and duplicate attempts are limited',async()=>{
 const f=fixture();const result=await request(f.handler);assert.equal(result.status,202);assert.equal(result.body.status,'transmitted');assert.equal(result.body.automaticDeletion,false);
 assert.equal(f.calls.auth[0].url,'https://fixture.invalid/auth/v1/user');assert.equal(f.calls.auth[0].options.method,undefined);
 const message=f.calls.mail[0];assert.equal(message.to.address,'contact@orevami.com');assert.equal(message.from.address,'contact@orevami.com');assert.equal(message.replyTo.address,user.email);assert.match(message.text,new RegExp(uid));assert(!JSON.stringify(result).includes('fixture-secret'));
 assert.equal((await request(f.handler)).status,429);assert.equal(f.calls.mail.length,1);
});
test('unverified identities, denied auth and SMTP errors never yield a success receipt or leak upstream errors',async()=>{
 for(const response of [{ok:false,status:401},{ok:true,json:async()=>({...user,email_confirmed_at:null})},{ok:true,json:async()=>({...user,email:'bad\r\nBcc:x@example.invalid'})}]){
  const f=fixture({fetcher:async()=>response});assert.equal((await request(f.handler)).status,401);assert.equal(f.calls.mail.length,0);
 }
 for(const sendMail of [async()=>{throw Error('password=fixture-secret-never-returned');},async()=>({accepted:[],rejected:['contact@orevami.com']})]){
  const f=fixture({sendMail});const result=await request(f.handler);assert.equal(result.status,502);assert(!JSON.stringify(result).includes('fixture-secret'));assert.equal(result.body.reference,undefined);
 }
});
test('the actual request page disables an unconfigured channel and shows success only after the API accepts a request',async()=>{
 for(const configured of [false,true]){
  const dom=new JSDOM(read('delete-account.html'),{url:'https://orevami.com/delete-account.html',runScripts:'outside-only'}),w=dom.window;let posts=0;
  try{
   w.AbortSignal=AbortSignal;w.myeventRuntime={ready:Promise.resolve({url:'https://fixture.invalid',publishableKey:'fixture',authStorageKey:'fixture'})};
   w.supabase={createClient:()=>({auth:{onAuthStateChange(){},getSession:async()=>({data:{session:{access_token:'fixture-valid-token'}}})}})};
   w.fetch=async(_url,options={})=>{if(options.method==='POST'){posts++;assert.equal(JSON.parse(options.body).confirmation,'SUPPRIMER MON COMPTE');return{status:202,json:async()=>({status:'transmitted',reference:rid,message:'Transmission confirmée par le serveur de messagerie ; traitement manuel.'})};}return{ok:true,json:async()=>({requestChannelConfigured:configured})};};
   w.eval(read('js/account-deletion.js'));await new Promise(r=>setTimeout(r,0));
   const form=w.document.getElementById('accountDeletionForm'),submit=w.document.getElementById('accountDeletionSubmit');assert.equal(submit.disabled,true);
   if(!configured){assert.equal(form.hidden,true);assert.match(w.document.getElementById('accountDeletionStatus').textContent,/pas encore activé/);assert.equal(posts,0);continue;}
   assert.equal(form.hidden,false);form.elements.confirm.checked=true;form.elements.confirm.dispatchEvent(new w.Event('change'));assert.equal(submit.disabled,false);
   form.dispatchEvent(new w.Event('submit',{cancelable:true}));await new Promise(r=>setTimeout(r,0));assert.equal(posts,1);assert.equal(submit.disabled,true);assert.match(w.document.getElementById('accountDeletionStatus').textContent,/Référence/);
  }finally{w.close();}
 }
});
test('profile entry is prominent, legal links resolve, server source is blocked and no ad SDK is added',()=>{
 const app=new JSDOM(read('index.html'));assert.equal(app.window.document.querySelector('#profileSettingsCard > p #accountDeletionProfileLink').getAttribute('href'),'delete-account.html#secureDeletion');app.window.close();
 for(const file of ['legal.html','privacy.html','delete-account.html']){
  const dom=new JSDOM(read(file));for(const a of dom.window.document.querySelectorAll('a[href]')){
   const href=a.getAttribute('href');if(!/^(https?:|mailto:|tel:|#)/.test(href))assert(existsSync(new URL('../'+href.split('#')[0],import.meta.url)),file+' → '+href);
  }dom.window.close();
 }
 const routes=JSON.parse(read('vercel.json')).routes;assert.equal(routes.find(r=>r.src&&new RegExp(r.src).test('/server/account-deletion-request.mjs')).status,404);
 assert(!/adsbygoogle|pagead2\.googlesyndication\.com/.test(read('js/account-deletion.js')));
 assert.equal(JSON.parse(read('package.json')).dependencies.nodemailer,'10.2.1');
});
