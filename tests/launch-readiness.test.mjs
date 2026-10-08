import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {JSDOM} from 'jsdom';
import {setupRecovery} from '../js/password-recovery.mjs';

test('ordinary accommodation pages keep partners without loading the paused Sabre search',async()=>{
 for(const file of ['index.html','explorer-partners-accommodation.html']){
  const html=await readFile(new URL('../'+file,import.meta.url),'utf8');
  assert.ok(!html.includes('src="js/hotel-search.js"'));
  for(const partner of ['fr-hcom','fr-expedia','abritel'])assert.ok(html.includes(partner));
 }
 assert.ok((await readFile(new URL('../lib/sabre-provider.js',import.meta.url),'utf8')).includes('GetHotelAvailRQ'));
});

test('reset request uses this environment, prevents duplicate requests and never reveals provider errors',async()=>{
 const html=await readFile(new URL('../index.html',import.meta.url),'utf8');const dom=new JSDOM(html);
 const d=dom.window.document;d.getElementById('email').value='myevent-a@example.invalid';let calls=0,release;
 const sb={auth:{resetPasswordForEmail:async(email,options)=>{calls++;assert.equal(email,'myevent-a@example.invalid');assert.equal(options.redirectTo,'https://preview.example/reset-password.html');await new Promise(resolve=>release=resolve);return {error:Error('SECRET provider error')};}}};
 const source=await readFile(new URL('../js/core-runtime.js',import.meta.url),'utf8');
 const fn=source.slice(source.indexOf('async function requestPasswordRecovery(){'),source.indexOf('\nfunction renderProfile'));
 const context=vm.createContext({sb,URL,location:{origin:'https://preview.example'},$:id=>d.getElementById(id),msg:(id,text)=>{d.getElementById(id).textContent=text;}});vm.runInContext(fn,context);
 const first=context.requestPasswordRecovery();await context.requestPasswordRecovery();assert.equal(calls,1);release();await first;
 assert.ok(!d.getElementById('authmsg').textContent.includes('SECRET'));assert.equal(d.getElementById('forgotPasswordBtn').disabled,false);dom.window.close();
});

async function fixture(recover){
 const dom=new JSDOM(await readFile(new URL('../reset-password.html',import.meta.url),'utf8'),{url:'https://preview.example/reset-password.html'});let callback,updates=0,logout=0;
 const client={auth:{onAuthStateChange:fn=>callback=fn,getSession:async()=>{if(recover)callback('PASSWORD_RECOVERY',{user:{id:'test'}});return {data:{session:{user:{id:'test'}}}};},updateUser:async()=>{updates++;return {};},signOut:async()=>{logout++;callback('SIGNED_OUT',null);return {};}}};
 await setupRecovery({document:dom.window.document,client,location:dom.window.location,history:dom.window.history});
 return {dom,form:dom.window.document.getElementById('recoveryForm'),counts:()=>({updates,logout})};
}
test('a normal session cannot display recovery; an SDK recovery session must confirm matching passwords',async()=>{
 const normal=await fixture(false);assert.equal(normal.form.hidden,true);normal.dom.window.close();
 const f=await fixture(true);assert.equal(f.form.hidden,false);
 f.form.elements.password.value='abcdefgh';f.form.elements.confirmation.value='different';f.form.dispatchEvent(new f.dom.window.Event('submit',{cancelable:true}));assert.equal(f.counts().updates,0);
 f.form.elements.confirmation.value='abcdefgh';f.form.dispatchEvent(new f.dom.window.Event('submit',{cancelable:true}));await new Promise(resolve=>setTimeout(resolve,0));
 assert.deepEqual(f.counts(),{updates:1,logout:1});assert.equal(f.form.hidden,true);assert.equal(f.form.elements.password.value,'');f.dom.window.close();
});
