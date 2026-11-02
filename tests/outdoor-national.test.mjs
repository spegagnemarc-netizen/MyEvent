import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {JSDOM} from 'jsdom';
import handler from '../server/outdoor-search.js';
import * as Core from '../js/outdoor-core.mjs';
const relation={type:'relation',id:123,tags:{type:'route',route:'hiking',name:'Fixture technique',sac_scale:'mountain_hiking'},members:[{type:'way',ref:1,geometry:[{lon:6,lat:44.58},{lon:6.1,lat:44.58}]}]};
const state=handler._test;
const response=(data,ok=true)=>({ok,status:ok?200:503,text:async()=>JSON.stringify(data)});
const reset=()=>{state.cache.clear();state.cooling.clear();};
test('only named route relations; segments remain separate; missing coordinates never bridged; difficulty stays unknown when absent',()=>{
 assert.throws(()=>Core.fromOSM({...relation,type:'way'}));
 assert.throws(()=>Core.fromOSM({...relation,tags:{type:'route',route:'hiking'}}));
 const r=Core.fromOSM({...relation,members:[...relation.members,{type:'way',ref:2,geometry:[{lon:6.2,lat:44.6},null,{lon:6.3,lat:44.6}]},{type:'relation',ref:456}]});
 assert.equal(r.geometry.coordinates.length,1);assert.match(r.extent_label,/partielle/);assert.equal(r.difficulty,'moderate');
 assert.equal(Core.fromOSM({...relation,tags:{...relation.tags,sac_scale:undefined}}).difficulty,'unknown');
 assert.ok(Core.nearGeometry({type:'MultiLineString',coordinates:[[[-1,45],[1,45]]]},[0,45],5));
 assert.equal(Core.nearGeometry({type:'MultiLineString',coordinates:[[[-1,45],[-0.9,45]],[[0.9,45],[1,45]]]},[0,45],5),false);
});
test('communes support department and postal code, cache, empty response and upstream failure',async()=>{
 const previous=global.fetch;let calls=[];reset();
 try{global.fetch=async url=>{calls.push(String(url));return response([{nom:'Gap',code:'05061',codeDepartement:'05',centre:{coordinates:[6.0616,44.5797]}}]);};
 assert.equal((await state.communes('Gap (05)')).communes[0].code,'05061');await state.communes('Gap (05)');assert.equal(calls.length,1);assert.match(calls[0],/nom=Gap/);assert.match(calls[0],/codeDepartement=05/);
 await state.communes('05000');assert.match(calls[1],/codePostal=05000/);
 global.fetch=async()=>response([]);assert.deepEqual((await state.communes('Inexistante')).communes,[]);
 global.fetch=async()=>response({},false);await assert.rejects(()=>state.communes('Lyon'),/indisponible/);
 }finally{global.fetch=previous;reset();}
});
test('discovery uses real relation geometries, deduplicates identical in-flight queries, caches, and distinguishes empty from provider outage',async()=>{
 const previous=global.fetch;let calls=0;reset();const params=new URLSearchParams({lon:'6.0616',lat:'44.5797',radius:'20'});
 try{global.fetch=async url=>{calls++;assert.match(String(url),/relation/);assert.doesNotMatch(String(url),/way\(/);return response({elements:[relation,{...relation,type:'way'}]});};
 const [a,b]=await Promise.all([state.discover(params),state.discover(params)]);assert.equal(calls,1);assert.deepEqual(a,b);assert.equal(a.routes.length,1);assert.equal(a.excluded,1);assert.equal(a.routes[0].source_url,'https://www.openstreetmap.org/relation/123');await state.discover(params);assert.equal(calls,1);
 await assert.rejects(()=>state.discover(new URLSearchParams({lon:'6',lat:'44',radius:'100'})),/invalide/);
 // Wait only for the deliberate two-second provider throttle, using synthetic clock advancement.
 const now=Date.now;let clock=now()+5000;Date.now=()=>clock;
 try{reset();global.fetch=async()=>response({elements:[]});assert.equal((await state.discover(params)).routes.length,0);
 clock+=5000;reset();global.fetch=async()=>{calls++;return response({},false);};await assert.rejects(()=>state.discover(params),/indisponible/);const failedCalls=calls;await assert.rejects(()=>state.discover(params));assert.equal(calls,failedCalls);
 }finally{Date.now=now;}
 }finally{global.fetch=previous;reset();}
});
test('TEST interface geocodes Gap, displays returned traces, filters without provider calls and clears stale routes on city failure',async()=>{
 const dom=new JSDOM('<div id="activitiesPanel"><nav class="act-tabs"></nav></div><div id="eventsWorkspace"></div>',{url:'https://test.example',runScripts:'outside-only'}),w=dom.window;
 try{let calls=[];w.OutdoorCore=Core;w.AbortSignal=AbortSignal;w.myeventRuntime={ready:Promise.resolve({environment:'preview',isTest:true,projectRef:'ahyyknfjsielnqyoxqgh'})};
 w.fetch=async url=>{calls.push(url);return {ok:true,json:async()=>url.includes('catalog')?[]:url.includes('commune=')?{communes:url.includes('Inexistante')?[]:[{nom:'Gap',code:'05061',codeDepartement:'05',centre:{coordinates:[6.0616,44.5797]}}]}:{routes:[Core.fromOSM(relation)],notice:'Source OSM',excluded:0,limited:false}};};
 const source=(await readFile(new URL('../js/outdoor-runtime.mjs',import.meta.url),'utf8')).replace(/^import .*?;\r?\n/,'const {modes,metrics,parseGPX,exportGPX,filterRoutes,validateGeometry}=window.OutdoorCore;\n');
 await w.eval('(async()=>{'+source+'})()');await w.OrevamiOutdoor.open();const f=w.document.getElementById('od-search');f.elements.city.value='Gap (05)';await f.onsubmit({preventDefault(){}});
 const choose=[...w.document.querySelectorAll('#od-tools button')].find(b=>b.textContent==='Choisir cette commune');choose?.click();await new Promise(r=>setTimeout(r,20));assert.equal(w.document.querySelectorAll('.od-card').length,1);
 const count=calls.filter(u=>u.includes('?lon=')).length;f.elements.activity.value='gravel';await f.onsubmit({preventDefault(){}});assert.equal(w.document.querySelectorAll('.od-card').length,0);assert.equal(calls.filter(u=>u.includes('?lon=')).length,count);
 f.elements.city.value='Inexistante';await f.onsubmit({preventDefault(){}});assert.match(w.document.getElementById('od-status').textContent,/Aucune commune/);assert.equal(w.document.querySelectorAll('.od-card').length,0);
 w.fetch=async()=>({ok:false,json:async()=>({error:'Panne simulée'})});f.elements.city.value='Lyon';await f.onsubmit({preventDefault(){}});assert.match(w.document.getElementById('od-status').textContent,/Géocodage indisponible/);
 w.fetch=async url=>url.includes('commune=')?{ok:true,json:async()=>({communes:[{nom:'Lyon',code:'69123',codeDepartement:'69',centre:{coordinates:[4.8357,45.764]}}]})}:{ok:false,json:async()=>({error:'Panne fournisseur simulée'})};
 await f.onsubmit({preventDefault(){}});[...w.document.querySelectorAll('#od-tools button')].find(b=>b.textContent==='Choisir cette commune')?.click();await new Promise(r=>setTimeout(r,20));
 assert.match(w.document.getElementById('od-discovery-status').textContent,/Fournisseur OSM indisponible/);assert.equal(w.document.querySelectorAll('.od-card').length,0);
 }finally{w.close();}
});
