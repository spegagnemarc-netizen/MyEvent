import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const core=readFileSync(new URL('../js/core-runtime.js',import.meta.url),'utf8');
const helper=core.slice(core.indexOf('function eventLoadScope'),core.indexOf('function eventLoadWarning'));
function setup(){
 const c={user:{id:'u'},event:{id:'A'},activeEventSelectionVersion:1,AbortController,setTimeout,clearTimeout};
 vm.createContext(c);vm.runInContext(helper,c);return c;
}
test('late responses are rejected after event, account, or selection generation changes',async()=>{
 for(const change of [c=>c.event={id:'B'},c=>c.user={id:'other'},c=>c.activeEventSelectionVersion++]){
  const c=setup();let resolve;const pending=c.eventRead(new Promise(r=>resolve=r),c.eventLoadScope());change(c);resolve({data:['old']});
  await assert.rejects(pending,e=>e.code==='EVENT_STALE');
 }
});
test('blocked Supabase request times out and receives an abort signal',async()=>{
 const c=setup();let signal;const request={abortSignal(s){signal=s;return new Promise(()=>{});}};
 await assert.rejects(c.eventRead(request,c.eventLoadScope(),5),e=>e.code==='EVENT_TIMEOUT');assert.equal(signal.aborted,true);
});
test('provider rejection remains distinguishable from stale responses',async()=>{
 const c=setup();await assert.rejects(c.eventRead(Promise.reject(new Error('network')),c.eventLoadScope()),/network/);
});
test('list reads are shared, cached per account, and explicit reloads bypass the cache',async()=>{
 let calls=0,resolve;
 const c={user:{id:'u'},eventsWorkspaceRows:[],eventsWorkspaceUserId:null,eventsListRequest:null,eventsListLoadedAt:0,eventsListEpoch:0,
 fetchEventsList:()=>{calls++;return new Promise(r=>resolve=r);}};
 vm.createContext(c);vm.runInContext(core.slice(core.indexOf('function loadEvents('),core.indexOf('async function fetchEventsList')),c);
 const a=c.loadEvents({useCache:true}),b=c.loadEvents({useCache:true});assert.equal(a,b);assert.equal(calls,1);
 c.eventsWorkspaceRows=[{id:'A'}];resolve(c.eventsWorkspaceRows);await a;
 assert.equal((await c.loadEvents({useCache:true}))[0].id,'A');assert.equal(calls,1);
 const forced=c.loadEvents();assert.equal(calls,2);resolve(c.eventsWorkspaceRows);await forced;
 c.user={id:'other'};const other=c.loadEvents({useCache:true});assert.equal(c.eventsWorkspaceRows.length,0);assert.equal(calls,3);resolve([]);await other;
});
test('stale media response cannot replace the currently visible media panel',async()=>{
 const c=setup();let resolve;const node={innerHTML:'B media'};
 c.$=()=>node;c.eventLoadWarning=()=>{};c.sb={from:()=>({select(){return this;},eq(){return this;},order:()=>new Promise(r=>resolve=r)})};
 vm.runInContext(core.slice(core.indexOf('async function loadMedia(){'),core.indexOf('async function loadPolls(){')),c);
 const pending=c.loadMedia();c.event={id:'B'};resolve({data:[]});await pending;assert.equal(node.innerHTML,'B media');
});

test('notification polling reuses the running request and isolates event changes',async()=>{
 const pending=[];const c={user:{id:'u'},event:{id:'A'},activeEventSelectionVersion:1,
 fetchEventNotifications:()=>new Promise(r=>pending.push(r))};
 vm.createContext(c);vm.runInContext(core.slice(core.indexOf('const eventNotificationLoads='),core.indexOf('async function fetchEventNotifications')),c);
 const a=c.refreshNotifications(),same=c.refreshNotifications();assert.equal(a,same);assert.equal(pending.length,1);
 c.event={id:'B'};c.activeEventSelectionVersion++;const b=c.refreshNotifications();assert.notEqual(a,b);assert.equal(pending.length,2);
 pending[0]();pending[1]();await Promise.all([a,b]);
});
