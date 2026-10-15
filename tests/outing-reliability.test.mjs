import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const require=createRequire(import.meta.url),planning=require('../server/outing-plan');
const source=readFileSync(new URL('../api/generate-outing-plan.js',import.meta.url),'utf8').replace("import planning from '../server/outing-plan.js';",'').replace('export default async function handler','module.exports = async function handler');
const place=(id,type,extra={})=>({id,name:'Lieu '+id,type,lat:44.56,lon:6.08,price_per_person:null,...extra});
const base={people:8,radius:20,center:{lat:44.56,lon:6.08},requested_steps:3,candidates:[place('r','restaurant',{price_per_person:15,capacity:20}),place('a','activity',{price_per_person:5,capacity:20}),place('b','nature',{price_per_person:0,capacity:20})]};
async function run(body={},upstream=async()=>{throw Object.assign(new Error('secret must not escape'),{name:'TimeoutError'});},env={OPENAI_API_KEY:'unit-test-secret'}){
 const logs=[],calls=[];const ctx={planning,module:{exports:{}},process:{env},AbortSignal,console:{warn:(...args)=>logs.push(args)},fetch:async(url,options)=>{calls.push({url,body:JSON.parse(options.body)});return upstream();}};
 vm.runInNewContext(source,ctx);const res={status(n){this.code=n;return this;},setHeader(){},json(data){this.body=data;return this;}};
 await ctx.module.exports({method:'POST',body:{...base,...body}},res);return {...res,logs,calls};
}
test('AI timeout produces a real-place deterministic fallback without invented prices or times',async()=>{
 const r=await run({budget_per_person:25});assert.equal(r.code,200);assert.equal(r.body.mode,'deterministic');assert.equal(r.body.fallback_reason,'AI_TIMEOUT');assert.equal(r.calls.length,1);
 for(const o of r.body.options){assert.equal(o.steps.length,3);assert.equal(o.total_estimated_per_person,20);for(const s of o.steps){assert(base.candidates.some(c=>c.id===s.candidate_id&&c.name===s.name));assert.equal(s.start_time,null);assert.equal(s.duration_minutes,null);assert.equal(s.price_is_estimate,false);}}
 assert(!JSON.stringify({body:r.body,logs:r.logs}).includes('unit-test-secret'));assert(!JSON.stringify(r.body).includes('secret must not escape'));
});
test('quota, network, malformed JSON, empty options and missing model credentials each yield a safe fallback',async()=>{
 for(const [upstream,reason] of [
  [async()=>({ok:false,status:429}),'AI_QUOTA'],[async()=>({ok:false,status:503}),'AI_HTTP'],
  [async()=>{throw Error('secret must not escape');},'AI_NETWORK'],
  [async()=>({ok:true,json:async()=>({output_text:'not json'})}),'AI_RESPONSE'],
  [async()=>({ok:true,json:async()=>({output_text:'{"options":[]}'})}),'AI_RESPONSE']
 ]){const r=await run({},upstream);assert.equal(r.code,200);assert.equal(r.body.fallback_reason,reason);assert(r.body.options.length);}
 const r=await run({},async()=>{throw Error('must not call');},{});assert.equal(r.code,200);assert.equal(r.calls.length,0);assert.equal(r.body.fallback_reason,'AI_NOT_CONFIGURED');
});
test('valid model IDs are kept, fabricated place data and price/time claims are discarded',async()=>{
 const r=await run({requested_steps:2,start_time:'18:00',meal_time:'19:00',meal_type:'dinner'},async()=>({ok:true,json:async()=>({output_text:JSON.stringify({options:[{steps:[{candidate_id:'r',type:'nature',price_per_person:999,start_time:'23:59',duration_minutes:90},{candidate_id:'a',name:'Invented'}]}]})})}));
 assert.equal(r.code,200);assert.equal(r.body.mode,'ai');const steps=r.body.options[0].steps;assert.equal(steps[0].candidate_id,'a');assert.equal(steps[0].start_time,'18:00');assert.equal(steps[1].candidate_id,'r');assert.equal(steps[1].start_time,'19:00');assert.equal(steps[1].price_per_person,15);assert.equal(steps[1].type,'restaurant');assert(!JSON.stringify(r.body).includes('Invented'));
});
test('invented IDs, duplicates and impossible model combinations trigger deterministic fallback',async()=>{
 for(const ids of [['r','ghost'],['r','r'],['a','b']]){const r=await run({requested_steps:2},async()=>({ok:true,json:async()=>({output_text:JSON.stringify({options:[{steps:ids.map(candidate_id=>({candidate_id}))}]})})}));assert.equal(r.code,200);assert.equal(r.body.mode,'deterministic');assert.equal(r.body.fallback_reason,'AI_RESPONSE');}
});
test('steps may be explicitly incomplete when only a smaller genuine combination exists',async()=>{
 const r=await run({requested_steps:5,candidates:base.candidates.slice(0,2)});assert.equal(r.code,200);assert.equal(r.body.requested_steps,5);assert.equal(r.body.options[0].steps.length,2);assert.equal(r.body.options[0].incomplete,true);assert.match(r.body.warning,/2 étapes disponibles sur 5/);
});
test('known budget, group capacity and radius constraints exclude incompatible places',async()=>{
 const ctx=planning.prepare({...base,budget_per_person:25,candidates:[...base.candidates,place('far','activity',{lat:45.5}),place('small','activity',{capacity:2}),place('expensive','activity',{price_per_person:99})]});assert.deepEqual(ctx.candidates.map(c=>c.id),['r','a','b']);
 for(const body of [{budget_per_person:1},{people:30},{candidates:[place('r','restaurant')]}]){const r=await run(body);assert.equal(r.code,422);assert.equal(r.calls.length,0);assert.match(r.body.code,/NO_COMPATIBLE/);}
 const r=await run({requested_steps:2,candidates:[place('r','restaurant',{price_per_person:20}),place('a','activity',{price_per_person:20})],budget_per_person:25});assert.equal(r.code,422);assert.equal(r.body.code,'NO_COMPATIBLE_COMBINATION');
});
test('unknown prices and capacities stay unknown and visibly unverified',async()=>{
 const r=await run({requested_steps:2,budget_per_person:20,candidates:[place('r','restaurant'),place('a','activity')]});assert.equal(r.code,200);const o=r.body.options[0];assert.equal(o.total_estimated_per_person,null);assert.equal(o.budget_verified,false);assert.equal(o.capacity_verified,false);assert.match(r.body.warning,/budget reste à confirmer/);assert.match(r.body.warning,/capacité/);
});
test('incompatible explicit times are explained before any model call',async()=>{const r=await run({start_time:'20:00',meal_time:'19:00'});assert.equal(r.code,422);assert.equal(r.body.code,'INCOMPATIBLE_TIMES');assert.equal(r.calls.length,0);});

test('meal type is preserved without inventing its time when only the start is supplied',async()=>{
 const r=await run({requested_steps:2,start_time:'18:00',meal_type:'dinner'});assert.equal(r.code,200);assert.equal(r.body.meal_type,'dinner');const steps=r.body.options[0].steps;assert.notEqual(steps[0].type,'restaurant');assert.equal(steps[0].start_time,'18:00');assert.equal(steps[1].type,'restaurant');assert.equal(steps[1].start_time,null);assert.match(r.body.warning,/horaire à préciser/);
});

test('a restrictive known budget can yield an explicitly smaller plan, never an over-budget plan',async()=>{
 const r=await run({requested_steps:4,budget_per_person:20,candidates:[place('r','restaurant',{price_per_person:15}),place('a','activity',{price_per_person:5}),place('b','nature',{price_per_person:5}),place('c','culture',{price_per_person:5})]});assert.equal(r.code,200);assert.equal(r.body.options[0].steps.length,2);assert.equal(r.body.options[0].total_estimated_per_person,20);assert.equal(r.body.options[0].incomplete,true);assert.match(r.body.warning,/2 étapes disponibles sur 4/);
});
