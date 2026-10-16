import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';
const source=readFileSync(new URL('../js/runtime-config.js',import.meta.url),'utf8');
const config={environment:'preview',isTest:true,projectRef:'ahyyknfjsielnqyoxqgh',url:'https://ahyyknfjsielnqyoxqgh.supabase.co',publishableKey:'sb_publishable_test_only',authStorageKey:'unchanged-test-storage'};
async function page(query='',value=config,ok=true,stored=false){
 const dom=new JSDOM('<body style="padding-top:12px"><section id="myeventAdminPanel" style="top:15px"></section></body>',{url:'https://preview.vercel.app/'+query,runScripts:'outside-only'});
 if(stored)dom.window.sessionStorage.setItem('orevami-filming-test-ahyyknfjsielnqyoxqgh','1');
 const requests=[];
 dom.window.fetch=async(...args)=>{requests.push(args);return {ok,json:async()=>({...value})};};
 dom.window.eval(source);
 let resolved;try{resolved=await dom.window.myeventRuntime.ready;}catch{}
 await new Promise(r=>setTimeout(r,0));
 return {dom,document:dom.window.document,resolved,requests};
}
test('default TEST link keeps banner visible',async()=>{
 const p=await page();const banner=p.document.getElementById('myeventEnvironmentBanner');assert.ok(banner);assert.equal(banner.hidden,false);assert.match(banner.textContent,/ORÉVAMI TEST/);p.dom.window.close();
});
test('filming hides only TEST banner without reserved space or config changes',async()=>{
 const p=await page('?tournage=1#home');const banner=p.document.getElementById('myeventEnvironmentBanner');assert.equal(banner.hidden,true);assert.equal(banner.style.display,'none');assert.equal(p.document.body.style.paddingTop,'12px');assert.equal(p.document.getElementById('myeventAdminPanel').style.top,'15px');assert.equal(p.document.documentElement.dataset.orevamiFilming,'true');assert.deepEqual(JSON.parse(JSON.stringify(p.resolved)),config);assert.equal(p.requests.length,1);assert.equal(p.requests[0][0],'/api/runtime-config');assert.equal(p.requests[0][1].credentials,'same-origin');p.dom.window.close();
});
test('explicit disable and unrecognized flag leave TEST banner visible',async()=>{
 for(const flag of ['0','true','']){const p=await page('?tournage='+flag);assert.equal(p.document.getElementById('myeventEnvironmentBanner').hidden,false);p.dom.window.close();}
});
test('Production cannot activate filming mode',async()=>{
 const p=await page('?tournage=1',{...config,environment:'production',isTest:false,projectRef:'nxxvadbliinhvkirqkkl',url:'https://nxxvadbliinhvkirqkkl.supabase.co'});assert.equal(p.document.documentElement.dataset.orevamiFilming,undefined);assert.equal(p.document.getElementById('myeventEnvironmentBanner'),null);p.dom.window.close();
});
test('wrong TEST project or Production URL stays blocked and visible',async()=>{
 for(const value of [{...config,projectRef:'nxxvadbliinhvkirqkkl',url:'https://nxxvadbliinhvkirqkkl.supabase.co'},{...config,url:'https://nxxvadbliinhvkirqkkl.supabase.co'}]){
  const p=await page('?tournage=1',value);assert.equal(p.resolved,undefined);const banner=p.document.getElementById('myeventEnvironmentBanner');assert.equal(banner.hidden,false);assert.match(banner.textContent,/CONNEXION BLOQUÉE/);p.dom.window.close();
 }
});
test('configuration failure remains visible even when filming requested',async()=>{
 const p=await page('?tournage=1',config,false);assert.equal(p.resolved,undefined);assert.match(p.document.getElementById('myeventEnvironmentBanner').textContent,/CONNEXION BLOQUÉE/);assert.equal(p.document.getElementById('myeventEnvironmentBanner').hidden,false);p.dom.window.close();
});

test('explicit opt-in persists only in TEST tab navigation and disable clears it',async()=>{
 const key='orevami-filming-test-ahyyknfjsielnqyoxqgh';
 const enabled=await page('?tournage=1');assert.equal(enabled.dom.window.sessionStorage.getItem(key),'1');enabled.dom.window.close();
 const navigation=await page('',config,true,true);assert.equal(navigation.document.getElementById('myeventEnvironmentBanner').hidden,true);navigation.dom.window.close();
 const disabled=await page('?tournage=0',config,true,true);assert.equal(disabled.document.getElementById('myeventEnvironmentBanner').hidden,false);assert.equal(disabled.dom.window.sessionStorage.getItem(key),null);disabled.dom.window.close();
});
