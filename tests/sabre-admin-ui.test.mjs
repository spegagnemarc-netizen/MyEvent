import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
const {JSDOM}=createRequire(import.meta.url)('jsdom');
const html=await readFile(new URL('../index.html',import.meta.url),'utf8'),script=await readFile(new URL('../js/admin-runtime.js',import.meta.url),'utf8');
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function fixture(preview=true){
 const source=new JSDOM(html),panel=source.window.document.getElementById('myeventAdminPanel').outerHTML;source.window.close();
 const dom=new JSDOM('<button id="myeventAdminEntry" hidden></button>'+panel,{runScripts:'outside-only',url:'https://preview.example.test/'}),w=dom.window;
 let id='owner-fixture',authCallback,resolveFetch;const calls=[];
 w.myeventRuntime={ready:Promise.resolve({isTest:preview,environment:preview?'preview':'production'})};
 w.AbortController=AbortController;w.HTMLElement.prototype.scrollIntoView=function(){};
 w.sb={auth:{getUser:async()=>({data:{user:{id}}}),getSession:async()=>({data:{session:{user:{id},access_token:'supabase-fixture-jwt'}}}),onAuthStateChange:fn=>{authCallback=fn;}},rpc:async name=>({data:name==='myevent_is_admin'?true:{}})};
 w.fetch=async(url,init)=>{calls.push({url,init});return new Promise(resolve=>resolveFetch=resolve);};
 w.eval(script);await sleep(500);w.document.getElementById('myeventAdminEntry').click();await sleep(10);
 return {w,dom,calls,respond:body=>resolveFetch({status:200,json:async()=>body}),switchUser:()=>{id='different-fixture';authCallback();}};
}
test('Preview admin controls send only session authentication and render comparison, safe text and rates',async()=>{
 const f=await fixture();try{
  const d=f.w.document;assert.equal(d.getElementById('myeventAdminSabreTab').hidden,false);d.getElementById('myeventAdminSabreTab').click();
  d.querySelector('[data-sabre-action="compare"]').click();await sleep(10);
  assert.equal(f.calls.length,1);assert.equal(f.calls[0].url,'/api/admin-sabre-diagnostic');const body=JSON.parse(f.calls[0].init.body);assert.equal(body.pcc,'S5OM');assert.equal(body.action,'compare');assert.equal(body.checkIn,'2026-11-10');assert.equal(body.guests,2);
  assert.ok(!JSON.stringify(body).match(/password|token|username/i));assert.equal(f.calls[0].init.headers.Authorization,'Bearer supabase-fixture-jwt');
  f.respond({real:true,connection:'connected',oauthHttp:[200],cases:[{pcc:'S5OM',http:[200],status:'ok',hotelCount:1,hotels:[{name:'<img onerror=alert(1)>',price:250,currency:'EUR',availability:'Tarif CERT'}]}]});await sleep(10);
  const results=d.getElementById('myeventAdminSabreResults');assert.match(results.textContent,/Connexion réussie/);assert.match(results.textContent,/250 EUR/);assert.equal(results.querySelector('img'),null);
  d.querySelector('[data-sabre-action="connection"]').click();await sleep(10);f.switchUser();f.respond({real:true,oauthHttp:[200],connection:'connected',cases:[{pcc:'S5OM',hotelCount:99}]});await sleep(20);assert.ok(!results.textContent.includes('99'));assert.match(results.textContent,/Aucun appel/);
 }finally{f.w.close();}
});
test('diagnostic is hidden and cannot issue requests outside Preview TEST',async()=>{
 const f=await fixture(false);try{assert.equal(f.w.document.getElementById('myeventAdminSabreTab').hidden,true);f.w.document.querySelector('[data-sabre-action="connection"]').click();await sleep(10);assert.equal(f.calls.length,0);}finally{f.w.close();}
});
