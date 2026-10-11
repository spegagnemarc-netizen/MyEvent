import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
function fixture(market=false){
 const dom=new JSDOM(read(market?'marketplace.html':'index.html').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,''),{url:'https://myevent.test/'+(market?'marketplace.html':'index.html'),runScripts:'outside-only'}),w=dom.window;
 w.scrollTo=()=>{};w.HTMLElement.prototype.scrollIntoView=()=>{};w.CSS={escape:s=>s};
 const ctx={user:{id:'existing-user'},event:{id:'event-a',name:'A',event_date:'2030-01-01'},role:'member',events:[{id:'event-a',name:'A',event_date:'2030-01-01'},{id:'event-b',name:'B',event_date:'2030-01-01'}]};
 w.myeventEventsBridge={context:()=>ctx,load:async()=>ctx.events,select:async id=>{ctx.event=ctx.events.find(e=>e.id===id);},cover:async()=>'',closeDiscussion:()=>{},form:id=>w.myeventEventsWorkspace.showForm(id),tab:()=>{}};
 let restored;
 w.MyEventMusic={closeMusic:()=>{}};w.MyEventMusicWorkspace={go:page=>{restored={section:'music',page};},resetNavigation:()=>{}};
 w.myeventEntertainment={close:()=>{},restore:state=>{restored=state;}};
 w.myeventProfileNavigation={open:()=>{},close:()=>{}};
 w.eval(read('js/section-navigation.js'));if(!market)w.eval(read('js/events-workspace.js'));
 w.document.dispatchEvent(new w.Event('DOMContentLoaded'));
 return {dom,w,ctx,getRestored:()=>restored};
}
const flush=()=>new Promise(r=>setTimeout(r,30));
test('Specific feed event is selected; inaccessible event cannot open tools',async()=>{
 const {dom,w,ctx}=fixture();await w.myeventEventsWorkspace.openSelected('event-b');assert.equal(ctx.event.id,'event-b');assert.equal(w.document.querySelector('#ewHero h2').textContent,'B');
 await assert.rejects(()=>w.myeventEventsWorkspace.openSelected('forbidden'));assert.equal(w.document.getElementById('eventsWorkspace').hidden,true);dom.window.close();
});
test('Event detail back restores Events and close invalidates old browser history',async()=>{
 const {dom,w}=fixture();await w.myeventEventsWorkspace.open();await w.myeventEventsWorkspace.openTool('polls');assert.equal(w.MyEventSectionNavigation.current().page,'polls');w.MyEventSectionNavigation.back();await flush();assert.equal(w.document.querySelector('.ewLanding').hidden,false);
 const old=w.history.state;w.MyEventSectionNavigation.close();await flush();assert.equal(w.MyEventSectionNavigation.current().section,'home');w.dispatchEvent(new w.PopStateEvent('popstate',{state:old}));await flush();assert.equal(w.MyEventSectionNavigation.current().section,'home');dom.window.close();
});
for(const [section,subpage] of [['music','playlists'],['games','setup'],['profile','settings']])test(section+' internal back and close',async()=>{
 const {dom,w,getRestored}=fixture();const n=w.MyEventSectionNavigation;n.visit(section,section==='games'?'hub':'home');n.visit(section,subpage);n.back();await flush();assert.equal(n.current().section,section);if(section!=='profile')assert.equal(getRestored().page,section==='games'?'hub':'home');n.close();await flush();assert.equal(n.current().section,'home');n.back();await flush();assert.equal(n.current().section,'home');dom.window.close();
});
test('Main section headers have one close button and no general back arrow',()=>{
 const {dom,w}=fixture();for(const section of ['events','marketplace','music','games','profile']){const h=w.MyEventSectionNavigation.header(section);assert.equal(h.querySelector('.meSectionBrand').textContent,'MyEvent');assert.equal(h.querySelectorAll('button').length,1);assert.equal(h.querySelector('button[aria-label="Retour"]'),null);assert(h.querySelector('button[aria-label="Fermer et revenir à l’accueil"]'));assert(h.querySelector('h1').textContent);}dom.window.close();
});
test('Marketplace detail returns to catalogue without leaving application',async()=>{
 const {dom,w}=fixture(true);w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;};const d=w.document.getElementById('listingDialog');d.open=true;w.MyEventSectionNavigation.visit('marketplace','listingDialog');w.MyEventSectionNavigation.back();await flush();assert.equal(d.open,false);assert.equal(w.MyEventSectionNavigation.current().page,'home');assert.equal(w.location.pathname,'/marketplace.html');dom.window.close();
});
test('Whole feed card is keyboard accessible and carries exact event id',async()=>{
 const {dom,w}=fixture();w.myeventCameraContext=()=>({user:{id:'existing-user'},sb:{rpc:async()=>({data:[{post_id:'post-a',event_id:'event-b',event_name:'B',is_member:true}]}),storage:{}}});
 w.eval(read('js/event-social-feed.js'));await w.myeventRefreshSocialFeed();const card=w.document.querySelector('.socialEventCard[data-event-id="event-b"]');assert(card);assert.equal(card.tabIndex,0);let opened;w.myeventViewSocialEvent=id=>{opened=id;};card.dispatchEvent(new w.KeyboardEvent('keydown',{key:'Enter',bubbles:true}));assert.equal(opened,'event-b');dom.window.close();
});
test('Every general header close returns home; Profile hides the status card above its identity',async()=>{
 const {dom,w}=fixture();for(const section of ['events','music','games','profile']){w.MyEventSectionNavigation.visit(section);const h=w.MyEventSectionNavigation.header(section);h.querySelector('.meSectionClose').click();await flush();assert.equal(w.MyEventSectionNavigation.current().section,'home');assert.equal(w.document.body.classList.contains('profileSectionOpen'),false);}w.MyEventSectionNavigation.visit('profile');assert.equal(w.document.body.classList.contains('profileSectionOpen'),true);assert.equal(w.document.getElementById('profileSettingsCard').firstElementChild.className,'meSectionHeader');dom.window.close();
});
test('Marketplace retains original brand subtitle and all toolbar actions',()=>{
 const {dom,w}=fixture(true),d=w.document;assert.equal(d.querySelectorAll('.marketHeader .brand').length,1);assert.equal(d.querySelector('.marketHeader .brand small').textContent,'MARKETPLACE');assert.equal(d.querySelectorAll('#myeventMarketplace>.meSectionHeader').length,0);assert(d.querySelector('.meMarketplaceIdentity>.meSectionClose'));for(const id of ['myListings','inboxButton','favoritesButton','createListing','marketThemeToggle'])assert(d.getElementById(id));dom.window.close();
});
test('Internal back controls are not hidden by the shared header styles',()=>{
 const css=read('css/section-navigation.css');assert(!css.includes('.musicScreenHead [data-back]'));assert(css.includes('#entertainmentLounge[data-game-screen="hub"] .gl-header'));assert(!css.includes('border-radius:18px'));assert(css.includes('body.profileSectionOpen #main>.card:not(#profileSettingsCard)'));
});
