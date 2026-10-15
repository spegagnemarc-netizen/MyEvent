import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const core=readFileSync(new URL('../js/core-runtime.js',import.meta.url),'utf8');
const helpers=core.slice(core.indexOf('function rememberedActiveEventId'),core.indexOf('async function show(u)'));
const select=core.slice(core.indexOf('async function selectEvent(id, options={})'),core.indexOf('\nfunction updateInviteUI'));
function setup(fetchEvent=async id=>({data:{id,name:'Event '+id,creator_id:'u'}})){
 const saved=new Map(),nodes=new Map();let resets=0;
 const c={event:null,user:{id:'u'},activeEventRole:'member',activeEventSelectionVersion:0,currentReservation:null,callActive:false,window:{},setTimeout(){},global(){},resetOutingModuleState(){resets++;},resetAiModuleState(){},localStorage:{getItem:k=>saved.get(k)||null,setItem:(k,v)=>saved.set(k,String(v)),removeItem:k=>saved.delete(k)},sessionStorage:{removeItem(){}},document:{querySelectorAll:()=>[],body:{classList:{remove(){}}}},$:id=>{if(!nodes.has(id))nodes.set(id,{textContent:'0'});return nodes.get(id);},sb:{from(){let id;return {select(){return this;},eq(k,v){if(k==='id')id=v;return this;},maybeSingle(){return fetchEvent(id);}}}}};
 for(const n of ['initializeUnreadMarkers','loadMessages','loadPolls','loadMembers','loadMedia','loadFund','loadWeather','refreshNotifications','renderInlineSelectedEvent','refreshReservationBoxes'])c[n]=async()=>{};
 for(const n of ['renderEventHero','updateInviteUI','subscribeRealtime'])c[n]=()=>{};
 vm.createContext(c);vm.runInContext(helpers+select,c);return {c,saved,resets:()=>resets};
}
test('reload restores the remembered event for that user, never the first row',async()=>{
 const {c,saved}=setup();saved.set('myevent_active_u','B');await c.restoreActiveEventSelection([{id:'A'},{id:'B'}]);assert.equal(c.event.id,'B');assert.equal(saved.get('myevent_active_u'),'B');
 c.event=null;await c.restoreActiveEventSelection([{id:'A'},{id:'B'}]);assert.equal(c.event.id,'B');
});
test('navigation restore leaves an active selection unchanged and preserves no-selection state',async()=>{
 const {c,saved,resets}=setup();await c.selectEvent('B');const count=resets();await c.restoreActiveEventSelection([{id:'A'},{id:'B'}]);assert.equal(c.event.id,'B');assert.equal(resets(),count);
 c.event=null;saved.clear();await c.restoreActiveEventSelection([{id:'A'}]);assert.equal(c.event,null);
});
test('failure opening another event preserves the previous selection and its stored ID',async()=>{
 const {c,saved}=setup(async id=>id==='bad'?{error:{message:'temporary network failure'}}:{data:{id,creator_id:'u'}});await c.selectEvent('B');await assert.rejects(c.selectEvent('bad'));assert.equal(c.event.id,'B');assert.equal(saved.get('myevent_active_u'),'B');
});
test('late A selection cannot replace a newer explicit B selection',async()=>{
 const pending={};const {c,saved}=setup(id=>new Promise(resolve=>pending[id]=resolve));
 const a=c.selectEvent('A'),b=c.selectEvent('B');pending.B({data:{id:'B',creator_id:'u'}});await b;pending.A({data:{id:'A',creator_id:'u'}});await a;assert.equal(c.event.id,'B');assert.equal(saved.get('myevent_active_u'),'B');
});
test('a response arriving after the account changes cannot select or persist an event',async()=>{
 let resolve;const {c,saved}=setup(()=>new Promise(r=>resolve=r));const a=c.selectEvent('A');c.user={id:'other'};resolve({data:{id:'A',creator_id:'u'}});await a;assert.equal(c.event,null);assert.equal(saved.size,0);
});
test('remembered selection is scoped to the account and cleared only when access is authoritatively absent',async()=>{
 const {c,saved}=setup();saved.set('myevent_active_u','B');saved.set('myevent_active_other','C');await c.restoreActiveEventSelection([{id:'A'},{id:'B'}]);
 await c.restoreActiveEventSelection([{id:'A'}]);assert.equal(c.event,null);assert.equal(saved.get('myevent_active_u'),undefined);assert.equal(saved.get('myevent_active_other'),'C');
 c.user={id:'other'};await c.restoreActiveEventSelection([{id:'C'}]);assert.equal(c.event.id,'C');
});

test('late outing generation cannot replace a plan for another event or another selection generation',async()=>{
 const src=readFileSync(new URL('../js/sorties-reservations-runtime.js',import.meta.url),'utf8');const fn=src.slice(src.indexOf('async function generateAiOutingPlan(){'),src.indexOf('\nfunction renderAiOutingPlans'));
 let resolve;const nodes={aiPlanGenerate:{disabled:false},aiPlanStatus:{},aiPlanResults:{},aiPlanRadius:{value:20},aiPlanSteps:{value:2}};
 const c={event:{id:'A'},user:{id:'u'},aiPlanLoadToken:0,$:id=>nodes[id],getActivitySearchCenter:async()=>({lat:44.56,lon:6.08}),fetch:()=>new Promise(r=>resolve=r),aiPlanCandidateType:p=>p.type};
 vm.createContext(c);vm.runInContext(fn,c);const pending=c.generateAiOutingPlan();await new Promise(r=>setImmediate(r));c.event={id:'B'};c.aiPlanLoadToken++;resolve({ok:true,json:async()=>({results:[]})});await pending;assert.equal(c.event.id,'B');assert.equal(c.aiOutingPlanData,undefined);assert.equal(nodes.aiPlanGenerate.disabled,false);
});
