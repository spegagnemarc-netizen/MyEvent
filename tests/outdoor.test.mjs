import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {JSDOM} from 'jsdom';
import {PGlite} from '@electric-sql/pglite';
import * as Core from '../js/outdoor-core.mjs';
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');
const geom={type:'MultiLineString',coordinates:[[[6,47,100],[6.01,47,120]],[[6.02,47,130],[6.03,47,110]]]};
const fixture={name:'TEST uniquement',geometry:geom,activity:'hike',visibility:'private',description:'',difficulty:'unknown',source_name:'Fixture technique',license:'TEST',...Core.metrics(geom)};
const A='11111111-1111-4111-8111-111111111111',B='22222222-2222-4222-8222-222222222222',C='33333333-3333-4333-8333-333333333333',EVENT='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
test('GPX preserves segments/altitudes and rejects hostile, incomplete and oversized files',()=>{
 const dom=new JSDOM();try{
  const xml=Core.exportGPX({...fixture,name:'A < B & C',source_url:'https://example.org'}),parsed=Core.parseGPX(xml,dom.window.DOMParser);assert.deepEqual(parsed.geometry,geom);assert.equal(parsed.name,'A < B & C');
  assert.throws(()=>Core.parseGPX('<!DOCTYPE gpx><gpx/>',dom.window.DOMParser));assert.throws(()=>Core.parseGPX('<gpx><trk><trkseg><trkpt lat="47"/></trkseg></trk></gpx>',dom.window.DOMParser));assert.throws(()=>Core.validateGeometry({}));assert.throws(()=>Core.validateGeometry({type:'MultiLineString',coordinates:[[[200,47],[6,47]]]}));assert.throws(()=>Core.parseGPX('x'.repeat(2000001),dom.window.DOMParser));
  assert.equal(Core.metrics(geom).ascent_m,20);assert.equal(Core.metrics({type:'MultiLineString',coordinates:[[[6,47],[6.01,47]]]}).ascent_m,null);
 }finally{dom.window.close();}
});
test('real catalogue has provenance, bounded coordinates and truthful sport/geography filters',async()=>{
 const rows=JSON.parse(await read('assets/outdoor/catalog.json'));assert.equal(rows.length,64);assert.equal(rows.filter(r=>r.activity==='hike').length,44);assert.equal(rows.filter(r=>r.activity==='mtb').length,9);assert.equal(rows.filter(r=>r.activity==='cycle').length,11);
 for(const r of rows){Core.validateGeometry(r.geometry);assert.match(r.source_url,/^https:\/\/www.data.gouv.fr\//);assert.ok(r.license&&r.source_name);assert.ok(r.distance_km>0);assert.equal(Core.metrics(r.geometry,r.activity).distance_km,r.distance_km);}
 assert.equal(Core.filterRoutes(rows,{activity:'mtb'}).length,9);assert.equal(Core.filterRoutes(rows,{activity:'gravel'}).length,0);assert.equal(Core.filterRoutes(rows,{center:[0,0],radius:5}).length,0);assert.ok(Core.filterRoutes(rows,{center:[6.03,47.24],radius:20}).length>0);
});
test('new TEST RLS enforces ownership, saved privacy, active members and server snapshot integrity',async()=>{
 const db=new PGlite();try{
 await db.exec(`create role authenticated;create role anon;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated,anon;create function public.myevent_account_active() returns boolean language sql stable as $$select current_setting('test.account_active',true) is distinct from 'false'$$;create table public.events(id uuid primary key,creator_id uuid);create table public.event_members(event_id uuid,user_id uuid,status text);grant select on public.events,public.event_members to authenticated;`);
 await db.query('insert into auth.users values($1),($2),($3)',[A,B,C]);await db.query('insert into public.events values($1,$2)',[EVENT,A]);await db.query("insert into public.event_members values($1,$2,'confirmed'),($1,$3,'pending')",[EVENT,B,C]);await db.exec(await read('supabase/test/outdoor-v1.sql'));
 const as=(id,sql,params=[],role='authenticated')=>db.transaction(async tx=>{await tx.exec('set local role '+role);await tx.query("select set_config('request.jwt.claim.sub',$1,true)",[id||'']);return tx.query(sql,params);});
 const create=async(owner,visibility='private')=>(await as(owner,`insert into public.outdoor_routes(owner_id,name,activity,visibility,geometry,distance_km,duration_min,source_name,license) values($1,'TEST','hike',$2,$3,1,30,'Fixture','TEST') returning id`,[owner,visibility,geom])).rows[0].id;
 const privateId=await create(A),publicId=await create(A,'public');assert.equal((await as(B,'select id from public.outdoor_routes')).rows.length,1);await assert.rejects(()=>as(null,'select id from public.outdoor_routes',[],'anon'),/permission denied/);
 await assert.rejects(()=>as(B,"update public.outdoor_routes set owner_id=$1 where id=$2",[B,publicId]).then(r=>{assert.equal(r.affectedRows,1);}));
 await assert.rejects(()=>as(A,'update public.outdoor_routes set owner_id=$1 where id=$2',[B,privateId]),/row-level security/);
 await assert.rejects(()=>as(B,'insert into public.outdoor_saved_routes(user_id,route_id) values($1,$2)',[B,privateId]),/row-level security/);
 await as(B,'insert into public.outdoor_saved_routes(user_id,route_id) values($1,$2)',[B,publicId]);assert.equal((await as(A,'select * from public.outdoor_saved_routes')).rows.length,0);
 await as(A,'insert into public.outdoor_event_routes(event_id,route_id,snapshot) values($1,$2,$3)',[EVENT,privateId,{name:'FORGED'}]);assert.equal((await as(B,'select snapshot from public.outdoor_event_routes')).rows[0].snapshot.name,'TEST');assert.equal((await as(C,'select * from public.outdoor_event_routes')).rows.length,0);
 assert.equal((await db.query("select public.outdoor_geometry_valid('{}'::jsonb) as valid")).rows[0].valid,false);
 await db.exec("set test.account_active='false'");assert.equal((await as(A,'select * from public.outdoor_routes')).rows.length,0);
 }finally{await db.close();}
});
test('Preview UI reuses map and event form; Production guard never mounts module',async()=>{
 const html='<nav class="act-tabs"></nav><div id="activitiesPanel"><nav class="act-tabs"></nav></div><div id="eventsWorkspace"></div><details id="createEventCard"><input id="ename"><textarea id="eventDescriptionInput"></textarea><input id="place"><button id="eventBtn">Créer</button></details>';
 for(const environment of ['preview','production']){
  const dom=new JSDOM(html,{url:'https://test.example/index.html',runScripts:'outside-only'}),w=dom.window;
  try{
   const calls=[];let events={user:{id:A},event:null,sb:null};const builder=()=>{const q={select(){return q;},order(){return q;},limit(){return q;},eq(){return q;},single(){return q;},insert(data){q.data=data;calls.push(data);return q;},then(resolve){return Promise.resolve({data:q.data?{...q.data,id:EVENT}:[],error:null}).then(resolve);}};return q;};events.sb={from:()=>builder()};w.myeventEventsBridge={context:()=>events,form:id=>{calls.push(id);w.document.getElementById(id).open=true;}};w.myeventRuntime={ready:Promise.resolve({environment,isTest:environment==='preview',projectRef:environment==='preview'?'ahyyknfjsielnqyoxqgh':'nxxvadbliinhvkirqkkl'})};w.document.getElementById('createEventCard').addEventListener('toggle',()=>{w.document.getElementById('ename').value='';});const handlers={};w.L={map:()=>({setView(){return this;},invalidateSize(){},fitBounds(){},on(n,fn){handlers[n]=fn;return this;}}),tileLayer:()=>({addTo(){}}),featureGroup:()=>({addTo(){return this;},clearLayers(){}}),geoJSON:()=>({addTo(){return this;},on(){return this;},getBounds:()=>({isValid:()=>true})})};w.OutdoorCore=Core;w.fetch=async()=>({ok:true,json:async()=>[fixture]});w.confirm=()=>true;w.alert=()=>{};w.HTMLElement.prototype.scrollIntoView=()=>{};
   const runtime=(await read('js/outdoor-runtime.mjs')).replace(/^import .*?;\n/,'const {modes,metrics,parseGPX,exportGPX,filterRoutes,validateGeometry}=window.OutdoorCore;\n');await w.eval('(async()=>{'+runtime+'})()');
   if(environment==='production'){assert.equal(w.document.getElementById('outdoorPanel'),null);continue;}
   assert.ok(w.document.querySelector('[data-outdoor-open]'));await w.OrevamiOutdoor.open();assert.equal(w.document.getElementById('outdoorPanel').hidden,false);[...w.document.querySelectorAll('#od-tools button')].find(b=>b.textContent.includes('Créer sur la carte')).click();await new Promise(r=>setTimeout(r,2));handlers.click({latlng:{lng:6,lat:47}});handlers.click({latlng:{lng:6.01,lat:47}});const editor=w.document.querySelector('#od-editor form');editor.elements.rights.checked=true;editor.dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));await new Promise(r=>setTimeout(r,5));assert.ok(calls.some(c=>c.geometry?.coordinates?.[0]?.length===2&&c.owner_id===A));w.OrevamiOutdoor.detail({...fixture,id:EVENT,owner_id:A});
   [...w.document.querySelectorAll('#od-detail button')].find(b=>b.textContent==='Organiser une sortie').click();await new Promise(r=>setTimeout(r,5));assert.ok(calls.includes('createEventCard'));assert.match(w.document.getElementById('ename').value,/Sortie/);
   const button=w.document.getElementById('eventBtn');button.click();button.disabled=true;await new Promise(r=>setTimeout(r,1));events.event={id:EVENT};button.disabled=false;await new Promise(r=>setTimeout(r,5));assert.ok(calls.some(c=>c.event_id===EVENT&&c.route_id===EVENT));
  }finally{w.close();}
 }
});
test('candidate preserves all pre-existing modules including reference Production',()=>{
 const cwd=new URL('../',import.meta.url);assert.doesNotThrow(()=>execFileSync('git',['merge-base','--is-ancestor','d1d08bb92153c20082d1ea7498e8dd7bed99ffa2','HEAD'],{cwd}));const paths=execFileSync('git',['diff','--name-only','c385f4be9d371e7e585be0ab10956b78cfd08934'],{cwd,encoding:'utf8'}).trim().split('\n').filter(Boolean);assert.ok(paths.every(p=>p==='index.html'||p==='package.json'||/^(js\/outdoor-|css\/outdoor|assets\/outdoor\/|supabase\/test\/outdoor-|tests\/outdoor|docs\/outdoor)/.test(p)),paths.join('\n'));
});
