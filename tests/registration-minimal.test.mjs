import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {JSDOM}=require(process.env.JSDOM_MODULE||'jsdom');
const source=await readFile(new URL('../js/registration-flow-v1.js',import.meta.url),'utf8');
function page(){
 const dom=new JSDOM('<main class="app"><section id="auth"><p id="authmsg"></p></section><section id="main"><input id="profileUsername"><button id="saveProfileBtn"></button></section></main>',{url:'https://test.example/register.html?friendInvite=11111111-1111-4111-8111-111111111111',runScripts:'outside-only'});
 const w=dom.window,calls=[];
 w.HTMLElement.prototype.scrollIntoView=()=>{};
 w.myeventRuntime={ready:Promise.resolve({isTest:true,projectRef:'ahyyknfjsielnqyoxqgh'})};
 w.msg=(id,t)=>w.document.getElementById(id).textContent=t;
 w.user=null;w.show=async()=>{};
 w.sb={rpc:async(name,args)=>{calls.push({name,args});return {data:name==='registration_username_available_v1'?true:'draft-token'};},auth:{signUp:async args=>{calls.push({name:'signUp',args});return {data:{session:null}};}}};
 w.eval(source);return {w,calls,form:w.document.querySelector('form')};
}
function fill(form){for(const [name,value] of Object.entries({username:'sorties_test',birth_date:'2010-05-20',email:'fixture@example.invalid',password:'a-long-test-password',confirmation:'a-long-test-password'}))form.elements[name].value=value;for(const name of ['terms','privacy'])form.elements[name].checked=true;}
test('minimal signup preserves private draft, optional fields and confirmation-pending result',async()=>{
 const {w,calls,form}=page();await w.orevamiRegistration.open();
 assert.equal(form.elements.phone,undefined);assert.equal(form.elements.last_name,undefined);
 assert.equal(form.elements.city.required,false);assert.equal(form.elements.first_name.required,false);
 assert.equal(form.elements.visibility.value,'private');assert.equal(form.elements.marketing.checked,false);
 fill(form);await form.onsubmit({preventDefault(){}});
 const draft=calls.find(c=>c.name==='registration_prepare_v1').args.p;
 assert.equal(draft.phone,'');assert.equal(draft.last_name,'');assert.equal(draft.city,'');
 const signup=calls.find(c=>c.name==='signUp').args;
 assert.deepEqual(Object.keys(signup.options.data),['registration_v1']);
 assert.equal(signup.options.data.birth_date,undefined);
 assert.match(signup.options.emailRedirectTo,/friendInvite=/);
 assert.match(w.document.getElementById('registrationMessage').textContent,/Demande prise en compte/);
 assert.doesNotMatch(w.document.getElementById('registrationMessage').textContent,/Compte créé|Téléphone vérifié/);
 w.close();
});
test('invalid or future birth date and missing consent never call Auth',async()=>{
 const {w,calls,form}=page();await w.orevamiRegistration.open();fill(form);
 form.elements.terms.checked=false;await form.onsubmit({preventDefault(){}});assert.equal(calls.length,0);
 form.elements.terms.checked=true;form.elements.birth_date.value='2099-01-01';await form.onsubmit({preventDefault(){}});
 assert.equal(calls.length,0);assert.match(w.document.getElementById('registrationMessage').textContent,/future/);w.close();
});
test('Auth error is shown without a false success',async()=>{
 const {w,form}=page();await w.orevamiRegistration.open();fill(form);
 w.sb.auth.signUp=async()=>({error:{message:'Envoi indisponible'}});
 await form.onsubmit({preventDefault(){}});assert.equal(w.document.getElementById('registrationMessage').textContent,'Envoi indisponible');w.close();
});
test('an existing incomplete account can edit the private profile without phone or identity',async()=>{
 const {w,form,calls}=page();w.user={id:'fixture',email:'fixture@example.invalid'};
 w.sb.rpc=async(name,args)=>{calls.push({name,args});return {data:name==='registration_status_v1'?{complete:false,email_verified:true}:null};};
 w.sb.from=()=>({select:()=>({eq:()=>({maybeSingle:async()=>({data:{username:'existing_member'}})})})});
 w.sb.storage={from:()=>({list:async()=>({data:[]})})};
 await w.orevamiRegistration.open(true);
 assert.equal(form.hidden,false);assert.equal(form.elements.email.readOnly,true);
 assert.equal(form.elements.username.value,'existing_member');
 assert.equal(form.elements.password.required,false);
 form.elements.birth_date.value='2000-06-01';for(const name of ['terms','privacy'])form.elements[name].checked=true;
 await form.onsubmit({preventDefault(){}});
 assert.equal(calls.filter(c=>c.name==='registration_save_v1').length,1);
 assert.equal(calls.some(c=>c.name==='signUp'),false);w.close();
});
