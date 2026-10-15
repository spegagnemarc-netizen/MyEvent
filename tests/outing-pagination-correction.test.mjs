import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const planning=createRequire(import.meta.url)('../server/outing-plan');
const p=(id,type)=>({id,name:id,type,place_type:type,lat:44.56,lon:6.08});
const sample={people:4,radius:20,center:{lat:44.56,lon:6.08},requested_steps:3,candidates:[...Array.from({length:75},(_,i)=>p('Restaurant '+i,'restaurant')),...Array.from({length:22},(_,i)=>p('Parc '+i,'nature'))]};
test('97 real-style candidates reproduce ten options and a next page even without culture or model metadata',()=>{
 for(const request of ['', 'restaurant + activité']){
  const body={...sample,request},ctx=planning.prepare(body),primary=planning.fallback(ctx),policy=planning.alternativePolicy(ctx,body,null),first=planning.expand(ctx,body,primary,policy);
  assert.equal(first.options.length,10);assert(first.paging.has_more);assert.deepEqual(first.options.slice(0,3),primary);
  const next=planning.expand(ctx,body,primary,policy,first.paging.next_cursor,true),key=o=>JSON.stringify(o.steps.map(s=>s.candidate_id).sort());
  assert.equal(next.options.length,10);assert(next.options.every(o=>!first.options.some(a=>key(a)===key(o))));
 }
});
test('a concrete preference uses actual place metadata while unknown attributes or exclusions remain blocked',()=>{
 const body={...sample,request:'restaurant + bowling',candidates:[...sample.candidates,{...p('Bowling Gap','activity'),place_type:'bowling_alley'}]},ctx=planning.prepare(body),policy=planning.alternativePolicy(ctx,body,null);
 assert(policy);const extra=planning.extraPage(ctx,[],policy);assert(extra.options.length);assert(extra.options.every(o=>o.steps.some(s=>s.candidate_id==='Bowling Gap')));
 for(const request of ['sans parc','restaurant avec terrasse','restaurant végétarien'])assert.equal(planning.alternativePolicy(ctx,{request},null),null);
});
const geoSource=readFileSync(new URL('../server/geoapify-places.js',import.meta.url),'utf8');
function geo(){let now=0,calls=0,fail=false;const context={module:{exports:{}},process:{env:{GEOAPIFY_API_KEY:'mock-secret'}},URL,URLSearchParams,AbortSignal,Date:{now:()=>now},fetch:async()=>{calls++;if(fail)throw Object.assign(new Error('private network detail'),{name:'TimeoutError'});return {ok:true,json:async()=>({features:[{properties:{name:'Real cached place'}}]})};}};vm.runInNewContext(geoSource,context);return {api:context.module.exports,calls:()=>calls,advance:n=>now=n,fail:()=>fail=true};}
test('identical category reads share a request and fresh cache makes no extra provider call',async()=>{
 const g=geo();const [a,b]=await Promise.all([g.api.searchPlaces(44.56,6.08,20,'entertainment'),g.api.searchPlaces(44.56,6.08,20,'entertainment')]);assert.equal(g.calls(),1);assert.deepEqual(a.features,b.features);
 const hit=await g.api.searchPlaces(44.56,6.08,20,'entertainment');assert(hit.cached);assert.equal(g.calls(),1);
});
test('a category timeout preserves only recent real results and exposes the safe cause; old cache expires',async()=>{
 const g=geo();await g.api.searchPlaces(44.56,6.08,20,'entertainment');g.advance(61000);g.fail();const partial=await g.api.searchPlaces(44.56,6.08,20,'entertainment');
 assert(partial.stale);assert.equal(partial.features[0].properties.name,'Real cached place');assert.equal(partial.failure.code,'PROVIDER_TIMEOUT');assert(!JSON.stringify(partial).includes('mock-secret'));assert(!JSON.stringify(partial).includes('private network detail'));
 g.advance(601000);await assert.rejects(g.api.searchPlaces(44.56,6.08,20,'entertainment'),e=>e.code==='PROVIDER_TIMEOUT');
});
test('cached places never cross a changed center, radius or category',async()=>{
 const g=geo();for(const [lat,radius,cat]of [[44.56,20,'entertainment'],[44.57,20,'entertainment'],[44.56,50,'entertainment'],[44.56,20,'sport']])await g.api.searchPlaces(lat,6.08,radius,cat);assert.equal(g.calls(),4);
});
test('category recovery remains a partial response and keeps the explicit timeout warning',async()=>{
 const src=readFileSync(new URL('../api/search-places.js',import.meta.url),'utf8'),fn=src.slice(src.indexOf('async function fetchNearbyOverpass'),src.indexOf('async function fetchPhoton'));
 const realGeo=createRequire(import.meta.url)('../server/geoapify-places');
 const context={process:{env:{GEOAPIFY_API_KEY:'mock'}},geoapify:{...realGeo,searchPlaces:async(lat,lon,radius,cat)=>({features:[{properties:{name:cat}}],cached:true,stale:cat==='entertainment',durationMs:10000,...(cat==='entertainment'?{failure:{code:'PROVIDER_TIMEOUT',error:'Délai dépassé.'}}:{})})}};
 vm.createContext(context);vm.runInContext(fn,context);const r=await context.fetchNearbyOverpass(44.56,6.08,20);assert(r.partial);assert.equal(r.features.length,3);assert.match(r.warning,/moins de dix minutes/);assert.equal(r.categoryStatus.find(s=>s.category==='culture').code,'PROVIDER_TIMEOUT');
});
test('next-page controls appear before and after choices, and absent paging is explicitly diagnosed',()=>{
 const src=readFileSync(new URL('../js/sorties-reservations-runtime.js',import.meta.url),'utf8'),fn=src.slice(src.indexOf('function renderAiOutingPlans(data){'),src.indexOf('let aiPlanSaving=false;'));
 const box={};const c={$:()=>box,esc:String,aiPlanCandidateLabel:String,aiPlanFormatPrice:String};vm.createContext(c);vm.runInContext(fn,c);
 c.renderAiOutingPlans({options:[{title:'Real plan',steps:[]}],paging:{has_more:true}});assert.equal((box.innerHTML.match(/data-ai-plan-more/g)||[]).length,2);assert(box.innerHTML.indexOf('data-ai-plan-more')<box.innerHTML.indexOf('Real plan'));
 c.renderAiOutingPlans({options:[{steps:[]}],paging:{has_more:false}});assert(!box.innerHTML.includes('data-ai-plan-more'));
 assert(src.includes('Cette réponse ne contient pas la pagination attendue'));
});

test('the actual handler expands a generic request after model timeout, preserving the real-place fallback',async()=>{
 const src=readFileSync(new URL('../api/generate-outing-plan.js',import.meta.url),'utf8').replace("import planning from '../server/outing-plan.js';",'').replace('export default async function handler','module.exports=async function handler');
 let calls=0;const c={planning,module:{exports:{}},process:{env:{OPENAI_API_KEY:'mock'}},AbortSignal,console:{warn(){}},fetch:async()=>{calls++;throw Object.assign(new Error('mock'),{name:'TimeoutError'});}};
 vm.runInNewContext(src,c);const r={status(n){this.code=n;return this;},setHeader(){},json(body){this.body=body;return this;}};
 await c.module.exports({method:'POST',body:{...sample,request:'restaurant + activité'}},r);assert.equal(calls,1);assert.equal(r.code,200);assert.equal(r.body.options.length,10);assert(r.body.paging.has_more);assert.equal(r.body.fallback_reason,'AI_TIMEOUT');assert.equal(r.body.planner_version,'more-options-2');
});
