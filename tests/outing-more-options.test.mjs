import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const planning=createRequire(import.meta.url)('../server/outing-plan');
const place=(id,type,extra={})=>({id,name:id,type,lat:44.56,lon:6.08,price_per_person:5,capacity:20,...extra});
const body={people:4,budget_per_person:30,radius:20,center:{lat:44.56,lon:6.08},requested_steps:3,candidates:[...Array.from({length:5},(_,i)=>place('r'+i,'restaurant')),...Array.from({length:8},(_,i)=>place('a'+i,['nature','culture','activity'][i%3]))]};
const key=o=>JSON.stringify(o.steps.map(s=>s.candidate_id).sort());
function initial(input=body){const ctx=planning.prepare(input),primary=planning.fallback(ctx),policy=planning.alternativePolicy(ctx,input,null);return {ctx,primary,policy,page:planning.expand(ctx,input,primary,policy)};}
test('first page retains the three original choices, fills ten, and varies venues and activities',()=>{
 const {primary,page}=initial();assert.equal(primary.length,3);assert.deepEqual(page.options.slice(0,3),primary);assert.equal(page.options.length,10);
 assert.equal(new Set(page.options.map(key)).size,10);assert(new Set(page.options.map(o=>o.steps.find(s=>s.type==='restaurant').candidate_id)).size>=4);
 assert(new Set(page.options.flatMap(o=>o.steps.filter(s=>s.type!=='restaurant').map(s=>s.candidate_id))).size>=4);assert(page.paging.has_more);
});
test('successive pages exhaust genuine combinations without repeats, preserving all constraints',()=>{
 const {ctx,primary,policy,page}=initial(),seen=new Set(page.options.map(key));let paging=page.paging,pages=0;
 while(paging.has_more){const next=planning.expand(ctx,body,primary,policy,paging.next_cursor,true);assert(next.options.length<=10);assert(++pages<100);
  for(const o of next.options){assert(!seen.has(key(o)));seen.add(key(o));assert(o.total_estimated_per_person<=30);assert.equal(o.steps.length,3);for(const s of o.steps){assert(ctx.candidates.some(c=>c.id===s.candidate_id));assert.equal(s.start_time,null);assert.equal(s.duration_minutes,null);}}
  paging=next.paging;
 }
 assert.equal(seen.size,5*28);
});
test('scarce places yield fewer than ten and never fabricate another place or permutation',()=>{
 const {page}=initial({...body,candidates:[place('r','restaurant'),place('a','nature')]});assert.equal(page.options.length,1);assert.equal(page.paging.has_more,false);assert(page.options[0].incomplete);
});
test('radius, capacity, known budget and explicit meal times remain enforced on additional choices',()=>{
 const input={...body,start_time:'18:00',meal_time:'19:00',meal_type:'dinner',budget_per_person:15,candidates:[...body.candidates,place('far','nature',{lat:46}),place('small','culture',{capacity:1}),place('costly','activity',{price_per_person:100})]};
 const {page}=initial(input);assert.equal(page.options.length,10);for(const o of page.options){assert(o.total_estimated_per_person<=15);assert.equal(o.steps[0].start_time,'18:00');assert.equal(o.steps[1].start_time,'19:00');assert(o.steps.every(s=>!['far','small','costly'].includes(s.candidate_id)));}
});
test('free-text preferences require verified candidate groups; unchecked criteria never silently widen the pool',()=>{
 const input={...body,request:'Un restaurant et du bowling'},ctx=planning.prepare(input),primary=planning.fallback(ctx);
 assert.equal(planning.alternativePolicy(ctx,input,null),null);assert.equal(planning.expand(ctx,input,primary,null).options.length,3);
 const policy=planning.alternativePolicy(ctx,input,{preferences_checked:true,alternative_candidate_ids:ctx.candidates.map(c=>c.id),required_candidate_groups:[['a0','a3']]});
 const page=planning.expand(ctx,input,primary,policy);for(const o of page.options.slice(3))assert(o.steps.some(s=>['a0','a3'].includes(s.candidate_id)));
 assert.equal(planning.alternativePolicy(ctx,input,{preferences_checked:true,alternative_candidate_ids:['invented'],required_candidate_groups:[]}),null);
});
test('unaffordable larger plans still preserve original partial choices and deduplicate their later pages',()=>{
 const input={...body,budget_per_person:10,requested_steps:4};const {ctx,primary,policy,page}=initial(input);assert.equal(page.options.length,10);assert(page.options.every(o=>o.steps.length===2&&o.incomplete));
 const restored=planning.fromModel({options:page.paging.primary_options},ctx,true);assert.deepEqual(restored.map(key),primary.map(key));
 const next=planning.expand(ctx,input,restored,policy,page.paging.next_cursor,true);assert(next.options.every(o=>!page.options.some(first=>key(first)===key(o))));
});
const handlerSource=readFileSync(new URL('../api/generate-outing-plan.js',import.meta.url),'utf8').replace("import planning from '../server/outing-plan.js';",'').replace('export default async function handler','module.exports=async function handler');
async function invoke(input,upstream){let calls=0;const c={planning,module:{exports:{}},process:{env:{OPENAI_API_KEY:'mock'}},AbortSignal,console:{warn(){}},fetch:async()=>{calls++;if(!upstream)throw Error('No provider expected');return upstream();}};vm.runInNewContext(handlerSource,c);
 const res={status(n){this.code=n;return this;},setHeader(){},json(data){this.body=data;return this;}};await c.module.exports({method:'POST',body:input},res);return {...res,calls};}
test('pagination makes zero provider requests and malformed page cursors fail safely',async()=>{
 const {page}=initial();const request={...body,mode:'alternatives',cursor:page.paging.next_cursor,primary_options:page.paging.primary_options,alternative_policy:page.paging.alternative_policy};
 const r=await invoke(request);assert.equal(r.calls,0);assert.equal(r.code,200);assert.equal(r.body.options.length,10);
 const invalid=await invoke({...request,cursor:-1});assert.equal(invalid.calls,0);assert.equal(invalid.code,400);
});
test('initial generation keeps one model request and appends deterministic extras',async()=>{
 const r=await invoke(body,async()=>({ok:true,json:async()=>({output_text:JSON.stringify({options:[{steps:[{candidate_id:'r0'},{candidate_id:'a0'},{candidate_id:'a1'}]},{steps:[{candidate_id:'r1'},{candidate_id:'a1'},{candidate_id:'a2'}]},{steps:[{candidate_id:'r2'},{candidate_id:'a2'},{candidate_id:'a3'}]}]})})}));
 assert.equal(r.code,200);assert.equal(r.calls,1);assert.equal(r.body.options.length,10);assert.equal(r.body.options[0].steps[0].candidate_id,'r0');assert.match(r.body.warning,/variantes supplémentaires/);
});
const client=readFileSync(new URL('../js/sorties-reservations-runtime.js',import.meta.url),'utf8');
function browser(){const nodes={aiPlanMore:{disabled:false,textContent:''},aiPlanStatus:{}};let resolve,fetches=0;const state={userId:'u',eventId:'A',token:1,request:body,paging:{has_more:true,next_cursor:7},busy:false};const c={aiPlanPagingState:state,event:{id:'A'},user:{id:'u'},aiPlanLoadToken:1,aiOutingPlanData:{options:[{steps:[{candidate_id:'old'}]}]},AbortSignal,$:id=>nodes[id],aiPlanCriteriaMatch:()=>true,renderAiOutingPlans(){},fetch:()=>{fetches++;return new Promise(r=>resolve=r);}};
 vm.createContext(c);vm.runInContext(client.slice(client.indexOf('async function loadMoreAiOutingPlans(){'),client.indexOf('function renderAiOutingPlans(data){')),c);return {c,state,nodes,resolve:r=>resolve(r),fetches:()=>fetches};}
test('double taps share the pending page and failed requests retain prior options and cursor',async()=>{
 const {c,state,nodes,resolve,fetches}=browser();const a=c.loadMoreAiOutingPlans(),b=c.loadMoreAiOutingPlans();assert.equal(fetches(),1);resolve({ok:false,json:async()=>({error:'unavailable'})});await Promise.all([a,b]);assert.equal(c.aiOutingPlanData.options.length,1);assert.equal(state.paging.next_cursor,7);assert.equal(state.busy,false);assert.equal(nodes.aiPlanMore.disabled,false);
});
test('late page responses are discarded after an event or account change',async()=>{
 for(const change of [c=>c.event={id:'B'},c=>c.user={id:'other'},c=>c.aiPlanLoadToken++]){
  const {c,resolve}=browser();const pending=c.loadMoreAiOutingPlans();change(c);resolve({ok:true,json:async()=>({options:[{steps:[{candidate_id:'late'}]}],paging:{has_more:false}})});await pending;assert.equal(c.aiOutingPlanData.options.length,1);
 }
});
