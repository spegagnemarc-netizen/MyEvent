import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {JSDOM} from 'jsdom';
import Routing from '../server/outdoor-routing.js';
import * as Core from '../js/outdoor-core.mjs';
const a=[6.475,44.5806],b=[6.476,44.581],c=[6.477,44.5806];
const way=(id,nodes,geometry,tags={})=>({type:'way',id,nodes,geometry:geometry.map(([lon,lat])=>({lon,lat})),tags:{highway:'path',...tags}});
test('routing follows shared OSM node IDs, profiles and directed access, never bridges gaps',()=>{
 const ways=[way(1,[1,2,3],[a,b,c])];
 const result=Routing.route(ways,{points:[a,c],mode:'hike'});assert.deepEqual(result.geometry.coordinates[0],[a,b,c]);assert.ok(Core.metrics(result.geometry).distance_km>Core.distance(a,c));
 assert.throws(()=>Routing.route(ways,{points:[a,c],mode:'cycle'}),/réseau/);
 assert.deepEqual(Routing.route(ways,{points:[a,c],mode:'mtb'}).geometry,result.geometry);
 assert.throws(()=>Routing.route([way(1,[1,2],[a,b]),way(2,[22,3],[b,c])],{points:[a,c],mode:'hike'}),/liaison/);
 for(const access of ['private','no'])assert.equal(Routing.allowed({highway:'path',foot:access},'hike'),false);
 assert.equal(Routing.allowed({highway:'path','mtb:scale':'4'},'mtb'),false);
 assert.equal(Routing.allowed({highway:'path','foot:conditional':'no @ (winter)'},'hike'),false);
 const road=[way(1,[1,2,3],[a,b,c],{highway:'residential',oneway:'yes'})];
 assert.throws(()=>Routing.route(road,{points:[c,a],mode:'cycle'}),/liaison|réseau/);
 assert.deepEqual(Routing.route(road,{points:[c,a],mode:'hike'}).geometry.coordinates[0],[c,b,a]);
 assert.throws(()=>Routing.route(ways,{points:[[0,0],c],mode:'hike'}),/150 m/);
 assert.throws(()=>Routing.parameters(new URLSearchParams({points:JSON.stringify([a,[0,0]]),mode:'hike'})),/20 km/);
});
const settle=()=>new Promise(r=>setTimeout(r,15));
test('Embrun exact commune searches directly; no-results and provider errors remain distinct',async()=>{
 const d=new JSDOM('<div id="activitiesPanel"><nav class="act-tabs"></nav></div><div id="eventsWorkspace"></div>',{url:'https://test.example',runScripts:'outside-only'}),w=d.window;
 try{w.OutdoorCore=Core;w.structuredClone=structuredClone;w.AbortSignal=AbortSignal;w.myeventRuntime={ready:Promise.resolve({environment:'production',isTest:false,projectRef:'nxxvadbliinhvkirqkkl'})};let broken=false;
 w.fetch=async u=>({ok:!broken,json:async()=>broken?{error:'Panne technique'}:u.includes('catalog')?[]:u.includes('commune=')?{communes:[{nom:'Embrun',codeDepartement:'05',centre:{coordinates:a}},{nom:'Saint-André-d’Embrun',codeDepartement:'05',centre:{coordinates:c}}]}:{routes:[],notice:'Couverture non exhaustive'}});
 const source=(await readFile(new URL('../js/outdoor-runtime.mjs',import.meta.url),'utf8')).replace(/^import .*?;\r?\n/,'const {modes,metrics,parseGPX,exportGPX,filterRoutes,validateGeometry}=window.OutdoorCore;\n');await w.eval('(async()=>{'+source+'})()');await w.OrevamiOutdoor.open();
 assert.doesNotMatch(w.document.querySelector('#od-list').textContent,/Aucun parcours/);
 const f=w.document.querySelector('#od-search');f.elements.city.value='Embrun';await f.onsubmit({preventDefault(){}});
 assert.match(w.document.querySelector('#od-list').textContent,/Aucun parcours trouvé/);assert.equal(w.document.querySelector('#od-tools select'),null);
 broken=true;f.elements.city.value='Lyon';await f.onsubmit({preventDefault(){}});assert.match(w.document.querySelector('#od-status').textContent,/Panne technique/);
 }finally{w.close();}
});
test('waypoints reorder and drag, routing recalculates, saves owner update and preserves GPX segments',async()=>{
 const d=new JSDOM('<div id="activitiesPanel"><nav class="act-tabs"></nav></div><div id="eventsWorkspace"></div>',{url:'https://test.example',runScripts:'outside-only'}),w=d.window;
 try{const owner='11111111-1111-4111-8111-111111111111',id='22222222-2222-4222-8222-222222222222',writes=[],handlers={},markers=[];
 const context={user:{id:owner},sb:{from(table){let op,data;const q={select(){return q;},single(){return q;},eq(){return q;},order(){return q;},limit(){return q;},update(v){op='update';data=v;return q;},insert(v){op='insert';data=v;return q;},then(resolve){if(op)writes.push({op,data,table});return Promise.resolve({data:op?{id}:[],error:null}).then(resolve);}};return q;}}};
 w.myeventEventsBridge={context:()=>context};w.OutdoorCore=Core;w.structuredClone=structuredClone;w.AbortSignal=AbortSignal;w.confirm=()=>true;w.HTMLElement.prototype.scrollIntoView=()=>{};
 w.L={map:()=>({setView(){return this;},on(n,f){handlers[n]=f;},invalidateSize(){},fitBounds(){}}),tileLayer:()=>({addTo(){}}),featureGroup:()=>({addTo(){return this;},clearLayers(){}}),geoJSON:()=>({addTo(){return this;},on(){return this;},getBounds:()=>({isValid:()=>true})}),marker:(p)=>{const m={p,events:{},addTo(){markers.push(this);return this;},on(n,f){this.events[n]=f;return this;},getLatLng(){return {lng:this.p[1],lat:this.p[0]};}};return m;}};
 w.myeventRuntime={ready:Promise.resolve({environment:'production',isTest:false,projectRef:'nxxvadbliinhvkirqkkl'})};let requests=0,broken=false;
 const geometry={type:'MultiLineString',coordinates:[[a,b,c]]};w.fetch=async url=>url.includes('catalog')?{ok:true,json:async()=>[]}:{ok:!broken,json:async()=>{requests++;return broken?{error:'Aucune liaison'}:{geometry,...Core.metrics(geometry),source_name:'Calcul sur réseau OpenStreetMap',source_url:'https://www.openstreetmap.org/copyright',license:'ODbL-1.0',notice:'Sans garantie de terrain.',max_snap_m:0};}};
 const source=(await readFile(new URL('../js/outdoor-runtime.mjs',import.meta.url),'utf8')).replace(/^import .*?;\r?\n/,'const {modes,metrics,parseGPX,exportGPX,filterRoutes,validateGeometry}=window.OutdoorCore;\n');await w.eval('(async()=>{'+source+'})()');await w.OrevamiOutdoor.open();
 const click=text=>[...w.document.querySelectorAll('button')].find(e=>e.textContent===text).click();click('Créer mon parcours');await settle();handlers.click({latlng:{lng:a[0],lat:a[1]}});handlers.click({latlng:{lng:c[0],lat:c[1]}});
 click('Calculer sur les chemins');await settle();assert.equal(requests,1);assert.match(w.document.querySelector('#od-status').textContent,/sur les chemins/);
 const m=markers.at(-1);m.p=[b[1],b[0]];m.events.dragend();const f=w.document.querySelector('#od-editor form');f.elements.rights.checked=true;await f.onsubmit({preventDefault(){}});assert.equal(writes.length,0,'stale geometry cannot save');
 click('Calculer sur les chemins');await settle();await f.onsubmit({preventDefault(){}});assert.equal(writes.length,1);assert.deepEqual(JSON.parse(JSON.stringify(writes[0].data.geometry.coordinates)),geometry.coordinates);
 w.OrevamiOutdoor.detail({...writes[0].data,id,owner_id:owner,...Core.metrics(geometry)});click('Modifier mon parcours');await settle();click('Calculer sur les chemins');await settle();const ef=w.document.querySelector('#od-editor form');ef.elements.rights.checked=true;await ef.onsubmit({preventDefault(){}});assert.equal(writes.at(-1).op,'update');
 click('Créer mon parcours');await settle();handlers.click({latlng:{lng:a[0],lat:a[1]}});handlers.click({latlng:{lng:c[0],lat:c[1]}});broken=true;click('Calculer sur les chemins');await settle();assert.match(w.document.querySelector('#od-status').textContent,/Aucun itinéraire calculé/);
 // Imported multi-segment geometries are edited as-is; no automatic joining or recalculation.
 const g={type:'MultiLineString',coordinates:[[a,b],[c,[c[0]+.001,c[1]]]]};w.OrevamiOutdoor.detail({id,owner_id:owner,name:'GPX',activity:'hike',visibility:'private',source_name:'GPX fourni par un membre',geometry:g,...Core.metrics(g)});click('Modifier mon parcours');await settle();assert.equal(w.document.querySelector('#od-editor input[name=name]').value,'GPX',w.document.querySelector('#od-status').textContent);const gf=w.document.querySelector('#od-editor form');gf.elements.rights.checked=true;await gf.onsubmit({preventDefault(){}});assert.match(w.document.querySelector('#od-status').textContent,/enregistré/,w.document.querySelector('#od-status').textContent);assert.deepEqual(JSON.parse(JSON.stringify(writes.at(-1).data.geometry)),g);
 }finally{w.close();}
});



