import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const code=readFileSync(new URL('../js/events-workspace.js',import.meta.url),'utf8');
const flush=()=>new Promise(resolve=>setTimeout(resolve,15));
function fixture(role='owner',events=true){
 const dom=new JSDOM(html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,''),{url:'https://myevent.test/',runScripts:'outside-only'});
 const w=dom.window;w.HTMLElement.prototype.scrollIntoView=()=>{};w.CSS={escape:s=>s};
 const event=events?{id:'event-1',name:'<Événement réel>',location:'Lyon',event_date:'2030-11-07T19:00:00Z',creator_id:'owner'}:null;
 const ctx={user:{id:role==='owner'?'owner':'member'},event,role,events:event?[event]:[]};let openCount=0;
 const members=w.document.getElementById('members');members.innerHTML='<button class="memberRow"><span class="avatar">👤</span><div class="memberInfo"><b>Alice</b><span>Créateur</span></div></button>';
 w.document.getElementById('eventList').innerHTML='<div class="eventCard" data-event-id="event-1"><div class="eventCardTopInfo"><b>Événement réel</b></div><div class="eventCardMenu"><button>Inviter</button></div></div>';
 w.myeventEventsBridge={context:()=>ctx,load:async()=>ctx.events,select:async()=>{},cover:async()=>'',closeDiscussion:()=>{},form:id=>w.myeventEventsWorkspace.showForm(id),tab:key=>{openCount++;w.myeventEventsWorkspace.syncTab(key,true);}};
 w.eval(code);return {w,dom,ctx,count:()=>openCount};
}
test('Moves the original tool nodes off Home and preserves camera event selectors',()=>{
 const {w}=fixture();const d=w.document;
 assert.equal(d.getElementById('weatherCard').parentElement.id,'ewDepot');
 assert.equal(d.querySelector('[data-panel="polls"]').parentElement.id,'ewDepot');
 assert(d.querySelector('#eventList .eventCard[data-event-id] .eventCardTopInfo b'));
 assert.equal(d.getElementById('eventsWorkspace').hidden,true);
 assert(d.getElementById('socialHeaderNotificationsBtnTop'));
});
test('Owner/coorganizer edit; participant keeps functional tools without edit',async()=>{
 for(const role of ['owner','coorganizer','member']){
  const {w,count,dom}=fixture(role);await w.myeventEventsWorkspace.open();await flush();
  assert.equal(!!w.document.querySelector('#ewHero [data-form="editEventBox"]'),role!=='member');
  assert.equal(w.document.querySelectorAll('.ewTool').length,6);
  assert.equal(w.document.querySelector('#ewHero h2').textContent,'<Événement réel>');
  await w.myeventEventsWorkspace.openTool('polls');assert.equal(count(),1);
  assert.equal(w.document.querySelector('[data-panel="polls"]').parentElement.id,'ewToolBody');
  w.myeventEventsWorkspace.close();assert.equal(w.document.querySelector('[data-panel="polls"]').parentElement.id,'ewDepot');
  dom.window.close();
 }
});
test('Empty state disables event actions and creation remains available',async()=>{
 const {w,dom}=fixture('member',false);await w.myeventEventsWorkspace.open();await flush();
 assert(w.document.querySelector('.ewEmptyCard'));
 assert([...w.document.querySelectorAll('.ewTool')].every(button=>button.disabled));
 w.document.querySelector('.ewHeader [data-form]').click();
 assert.equal(w.document.getElementById('createEventCard').parentElement.id,'ewToolBody');
 dom.window.close();
});
