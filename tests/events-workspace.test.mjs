import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const code=readFileSync(new URL('../js/events-workspace.js',import.meta.url),'utf8');
const flush=()=>new Promise(resolve=>setTimeout(resolve,15));
test('Only the current navigation item lights up and camera restores its previous page',async()=>{
 const {w,dom}=fixture();const nav=w.document.getElementById('socialBottomNav');
 nav.querySelector('[data-bottom-tab="games"]').click();await flush();
 assert.equal(nav.querySelectorAll('.active').length,1);
 assert.equal(nav.querySelector('.active').dataset.bottomTab,'games');
 w.document.body.classList.add('camera-is-open');await flush();
 assert.equal(nav.querySelectorAll('.active').length,1);
 assert.equal(nav.querySelector('.active').id,'socialBottomCreate');
 w.document.body.classList.remove('camera-is-open');await flush();
 assert.equal(nav.querySelector('.active').dataset.bottomTab,'games');
 dom.window.close();
});
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
  assert.equal(w.document.querySelectorAll('.ewTool').length,10);
  assert.equal(w.document.querySelector('#ewHero h2').textContent,'<Événement réel>');
  await w.myeventEventsWorkspace.openTool('polls');assert.equal(count(),1);
  assert.equal(w.document.querySelector('[data-panel="polls"]').parentElement.id,'ewToolBody');
  w.myeventEventsWorkspace.close();assert.equal(w.document.querySelector('[data-panel="polls"]').parentElement.id,'ewDepot');
  dom.window.close();
 }
});

test('Ten existing tools remain in six/four pages with participants and secondary navigation',async()=>{
 const {w,dom}=fixture();await w.myeventEventsWorkspace.open();await flush();
 const pages=[...w.document.querySelectorAll('.ewToolsPage')];
 assert.deepEqual(pages.map(page=>page.querySelectorAll('.ewTool').length),[6,4]);
 assert.deepEqual([...w.document.querySelectorAll('.ewTool')].map(b=>b.dataset.tool),['weather','call','discussion','polls','media','tasks','aioutings','fund','music','games']);
 assert.deepEqual([...w.document.querySelectorAll('.ewSections button')].map(b=>b.dataset.tool),['members','programme','locations','transport','documents','accommodation','outings','localtravel','hall']);
 assert.equal(w.document.querySelector('#ewParticipants'),null);
 assert(w.document.querySelector('.ewSections [data-tool="members"]'));
 assert(w.document.querySelector('#ewHero [data-tool="members"]'));
 for(const key of ['weather','call','polls','media','tasks','aioutings','fund','members','locations','supplies','transport','accommodation','outings','localtravel','hall']){
  await w.myeventEventsWorkspace.openTool(key);
  assert(w.document.querySelector('#ewToolBody .ewPanel'),key+' opens its original panel');
 }
 dom.window.close();
});
test('Empty state disables event actions and creation remains available',async()=>{
 const {w,dom}=fixture('member',false);await w.myeventEventsWorkspace.open();await flush();
 assert(w.document.querySelector('.ewEmptyCard'));
 assert([...w.document.querySelectorAll('.ewTool')].every(button=>button.disabled));
 w.document.querySelector('.ewHeader [data-form]').click();
 assert.equal(w.document.getElementById('createEventCard').parentElement.id,'ewToolBody');
 dom.window.close();
});
test('Visible hall entry opens the original search panel and preserves ten tools',async()=>{
 const {dom,w}=fixture();await w.myeventEventsWorkspace.open();const d=w.document,b=d.querySelector('.ewSections [data-tool="hall"]');assert(b);assert(b.textContent.includes('Recherche de salles'));assert.equal(b.disabled,false);b.click();await flush();assert.equal(d.getElementById('hallPanel').parentElement.id,'ewToolBody');assert(d.getElementById('hallSearchBtn'));assert.equal(d.querySelectorAll('.ewTool').length,10);assert.equal(d.querySelector('.ewHallSearchAccess'),null);assert.equal(d.querySelector('.ewSections [data-tool="supplies"]'),null);assert.equal(d.querySelector('.ewExtras [data-tool]'),null);for(const key of ['accommodation','outings','localtravel','hall'])assert.equal(d.querySelectorAll('.ewLanding [data-tool="'+key+'"]').length,1);await w.myeventEventsWorkspace.openTool('tasks');d.querySelector('.ewTaskActions button').click();assert.equal(d.querySelector('[data-panel="supplies"]').parentElement.id,'ewToolBody');dom.window.close();
});

test('selection survives filtering, return navigation and closing; no first-row replacement',async()=>{
 const {w,ctx,dom}=fixture();const original=ctx.event;ctx.events.push({id:'older',name:'Passé',creator_id:'owner',event_date:'2020-01-01'});let selections=0;
 w.myeventEventsBridge.select=async id=>{selections++;ctx.event=ctx.events.find(e=>e.id===id);};
 try{
  await w.myeventEventsWorkspace.open();w.document.querySelector('[data-filter="past"]').click();await flush();assert.equal(ctx.event.id,original.id);assert.equal(selections,0);
  w.myeventEventsWorkspace.close();await w.myeventEventsWorkspace.restore({page:'landing',eventId:'older'});assert.equal(ctx.event.id,original.id);assert.equal(selections,0);
  ctx.event=null;await w.myeventEventsWorkspace.open();assert.equal(ctx.event,null);assert.equal(selections,0);
 }finally{dom.window.close();}
});

test('picker and hero keep the committed ID while a requested selection is pending or fails',async()=>{
 const {w,ctx,dom}=fixture();ctx.events.push({id:'B',name:'Test',event_date:'2030-01-01'});let reject;
 w.myeventEventsBridge.select=()=>new Promise((_,r)=>reject=r);
 await w.myeventEventsWorkspace.open();
 const picker=w.document.getElementById('ewSelectedEvent');picker.value='B';picker.dispatchEvent(new w.Event('change'));
 assert.equal(w.document.getElementById('ewSelectedEvent').value,ctx.event.id);
 assert.equal(w.document.querySelector('#ewHero h2').textContent,ctx.event.name);
 reject(new Error('Réseau indisponible'));await flush();assert.match(w.document.getElementById('ewStatus').textContent,/Réseau/);
 assert.equal(w.document.getElementById('ewSelectedEvent').value,ctx.event.id);dom.window.close();
});
test('cached event renders before list refresh finishes and latest rapid selection wins',async()=>{
 const {w,ctx,dom}=fixture();ctx.events.push({id:'B',name:'Test',event_date:'2030-01-01'},{id:'C',name:'Dernier',event_date:'2030-01-01'});
 let finish;w.myeventEventsBridge.load=()=>new Promise(r=>finish=r);
 const opening=w.myeventEventsWorkspace.open();assert.equal(w.document.querySelector('#ewHero h2').textContent,ctx.event.name);finish();await opening;
 const pending={};w.myeventEventsBridge.select=id=>new Promise(r=>{pending[id]=()=>{ctx.event=ctx.events.find(e=>e.id===id);r();};});
 for(const id of ['B','C']){const picker=w.document.getElementById('ewSelectedEvent');picker.value=id;picker.dispatchEvent(new w.Event('change'));}
 pending.C();await flush();assert.equal(w.document.getElementById('ewSelectedEvent').value,'C');assert.equal(w.document.getElementById('ewStatus').textContent,'');
 // Real core guards the stale response; here finish without mutating the committed context.
 dom.window.close();
});
