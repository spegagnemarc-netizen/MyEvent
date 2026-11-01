import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {JSDOM} from 'jsdom';
import * as Core from '../js/outdoor-core.mjs';
const root=new URL('../',import.meta.url),read=p=>readFile(new URL(p,root),'utf8');
const settle=()=>new Promise(r=>setTimeout(r,5));
const OWNER='cfd3f5c6-afd7-46a5-890e-d1e8ad14102c',ROUTE='f06e0cdf-22c2-4530-a7b6-630c601e0e29',EVENT='8724d9b4-8dbe-4043-a38d-da57e8608b60';
test('observed regressions: activity overlay closes and delayed creation remains linked until explicit cancellation',async()=>{
 for(const cancel of [false,true]){
  const dom=new JSDOM('<div id="activitiesPanel"><nav class="act-tabs"></nav><button id="act-close">Fermer les activités</button></div><div id="eventsWorkspace"></div><details id="createEventCard"><input id="ename"><input id="place"><textarea id="eventDescriptionInput"></textarea><button id="eventBtn">Créer</button></details>',{url:'https://test.example/',runScripts:'outside-only'}),w=dom.window;
  try{
   const links=[];let expiry;const originalTimer=w.setTimeout.bind(w);w.setTimeout=(fn,ms,...args)=>{if(ms===180000){expiry=fn;return originalTimer(()=>{},9999999);}return originalTimer(fn,ms,...args);};
   const context={user:{id:OWNER},event:null,sb:{from:()=>{const q={insert(data){links.push(data);return q;},select(){return q;},order(){return q;},limit(){return q;},eq(){return q;},then(resolve){return Promise.resolve({data:[],error:null}).then(resolve);}};return q;}}};
   w.myeventRuntime={ready:Promise.resolve({environment:'preview',isTest:true,projectRef:'ahyyknfjsielnqyoxqgh'})};w.OutdoorCore=Core;w.fetch=async()=>({ok:true,json:async()=>[]});w.confirm=()=>true;w.alert=()=>{};w.HTMLElement.prototype.scrollIntoView=()=>{};
   w.document.getElementById('act-close').onclick=()=>{w.document.getElementById('activitiesPanel').hidden=true;};
   w.myeventEventsBridge={context:()=>context,form:()=>{w.document.getElementById('createEventCard').open=true;}};
   const source=(await read('js/outdoor-runtime.mjs')).replace(/^import .*?;\r?\n/,'const {modes,metrics,parseGPX,exportGPX,filterRoutes,validateGeometry}=window.OutdoorCore;\n');await w.eval('(async()=>{'+source+'})()');
   await w.OrevamiOutdoor.open();w.OrevamiOutdoor.detail({id:ROUTE,owner_id:OWNER,name:'TEST recette',activity:'mtb',visibility:'private',geometry:{type:'MultiLineString',coordinates:[[[6,47],[6.01,47]]]},distance_km:1,duration_min:5});
   [...w.document.querySelectorAll('#od-detail button')].find(b=>b.textContent==='Organiser une sortie').click();await settle();await settle();
   assert.equal(w.document.getElementById('activitiesPanel').hidden,true,'Form must not remain behind Activities');assert.ok(w.document.getElementById('ename').value.startsWith('Sortie'));
   if(expiry)expiry(); // Reproduce the old three-minute expiry before the user submits.
   const cancelButton=w.document.getElementById('outdoorCancelEventDraft');assert.ok(cancelButton);
   if(cancel)cancelButton.click();
   const submit=w.document.getElementById('eventBtn');submit.click();submit.disabled=true;await settle();context.event={id:EVENT};submit.disabled=false;await settle();
   assert.equal(links.filter(x=>x.event_id===EVENT&&x.route_id===ROUTE).length,cancel?0:1);assert.equal(w.document.getElementById('outdoorCancelEventDraft'),null);
  }finally{w.close();}
 }
});
test('catalogue review labels 47 near-closed producer routes, 6 open traces and 11 fragment collections without altering traces',async()=>{
 const rows=JSON.parse(await read('assets/outdoor/catalog.json')),original=JSON.parse(execFileSync('git',['show','8f028377bd544e2961d56a5373eb0e73e360c4b9:assets/outdoor/catalog.json'],{cwd:root,encoding:'utf8',maxBuffer:5000000}));
 assert.deepEqual(rows.reduce((a,r)=>(a[r.extent_kind]=(a[r.extent_kind]||0)+1,a),{}),{loop:47,open:6,sections:11});
 for(const row of rows){assert.deepEqual(row.geometry,original.find(r=>r.id===row.id).geometry);assert.ok(row.extent_label);if(row.extent_kind==='sections')assert.match(row.extent_label,/continuité non garantie/);}
});
test('integration preserves current Production modules and adds only two index references',()=>{
 const git=(...args)=>execFileSync('git',args,{cwd:root,encoding:'utf8'});
 assert.equal(git('diff','6d83eee0a7c7097b065ee6fd35ccf51aea0891ef','--','js/core-runtime.js','js/entertainment-lounge.js','js/additional-games.js','js/home-social-runtime.js','js/event-social-feed.js','js/camera-feed-refresh.js','js/section-navigation.js','js/activities-runtime.js','js/music-workspace.js','css/event-social-feed.css','css/section-navigation.css','privacy.html','delete-account.html','server','api','mobile'),'');
 const changed=git('diff','6d83eee0a7c7097b065ee6fd35ccf51aea0891ef','--','index.html').split('\n').filter(l=>/^[+-]/.test(l)&&!/^\+\+\+|^---/.test(l));assert.equal(changed.length,2);assert.ok(changed.every(l=>l.startsWith('+')&&l.includes('outdoor')));
 const runtime=git('diff','--','js/outdoor-runtime.mjs');assert.ok(!runtime.includes('--prod'));
});
