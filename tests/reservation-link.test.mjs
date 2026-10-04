import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {runInContext} from 'node:vm';
const require=createRequire(import.meta.url),api=require('../js/reservation-link-contract.js'),{JSDOM}=require('jsdom');
const runtime=readFileSync(new URL('../js/reservation-link-runtime.js',import.meta.url),'utf8');
const url='https://www.abritel.fr/location-vacances/p12148790a?chkin=2026-10-05&chkout=2026-10-06&destination=Gap&adults=2&latLong=44.559639,6.079758&affcid=ORIGINAL';
const valid={original_url:url,kind:'accommodation',name:'Maison choisie',destination:'Gap',start:'2026-10-05',end:'2026-10-06',travelers:'2',status:'added'};
test('URL validation rejects unsafe protocols, credentials, localhost, IP encodings, ports and control characters',()=>{
 for(const bad of ['javascript:alert(1)','http://expedia.fr/','https://user:pass@expedia.fr/','https://127.0.0.1/','https://0x7f000001/','https://2130706433/','https://[::1]/','https://[::ffff:127.0.0.1]/','https://localhost/','https://foo.local/','https://service.internal/','https://expedia.fr:8080/','https://expedia.fr/\nfoo','https://expedia.fr\\@evil.com/'])assert.throws(()=>api.extract(bad),bad);
});
test('exact host boundaries detect four providers and accept another public partner without claiming affiliation',()=>{
 for(const [domain,name] of [['fr.hotels.com','Hotels.com'],['www.expedia.fr','Expedia'],['www.abritel.fr','Abritel'],['www.omio.com','Omio']])assert.equal(api.extract('https://'+domain+'/').provider,name);
 assert.equal(api.extract('https://expedia.fr.evil.com/').provider,'expedia.fr.evil.com');
 assert.equal(api.extract('https://other-partner.com/?destination=Paris').destination,'');
});
test('only explicit URL parameters are extracted; coordinates, name, photo and confirmation are never invented',()=>{
 const data=api.extract(url);assert.equal(data.destination,'Gap');assert.equal(data.start,'2026-10-05');assert.equal(data.travelers,'2');
 assert.equal(data.name,'');assert.equal(data.address,'');assert.equal(data.photo,'');assert.equal(data.geo,null);assert.equal(data.status,'added');assert.equal(data.original_url,url);
 assert.equal(api.extract('https://www.expedia.fr/Flights-Search?d1=2026-10-05').kind,'transport');
});
test('invalid leap days, traveler counts and reversed dates are not silently accepted',()=>{
 assert.equal(api.date('2026-02-29'),'');assert.equal(api.date('2028-02-29'),'2028-02-29');
 assert.equal(api.extract('https://omio.com/?adults=-2&d1=2026-02-29').travelers,'');
 for(const change of [{name:''},{start:'2026-02-29'},{end:'2026-10-04'},{travelers:'0'},{travelers:'100'},{travelers:'2.5'},{start:'2026-10-05T25:00'},{photo:'javascript:evil()'}])assert.throws(()=>api.payload({...valid,...change}));
});
test('booking status requires a distinct explicit user declaration; original tracking survives persistence',()=>{
 const data=api.payload(valid);assert.equal(data.original_url,url);assert.equal(data.booking,url);assert.equal(data.reservation_status,'added');assert.equal(data.confirmation_source,null);
 assert.throws(()=>api.payload({...valid,status:'confirmed'}));
 assert.equal(api.payload({...valid,status:'confirmed',confirmed_by_user:true}).confirmation_source,'user_declared');
});
test('coordinates need address and explicit verification; zero coordinates remain valid and unverified map data is excluded',()=>{
 assert.equal(api.payload({...valid,lat:'44.5',lon:'6'}).geo,null);
 assert.throws(()=>api.payload({...valid,lat:'44.5',lon:'6',geo_verified:true}));
 assert.throws(()=>api.payload({...valid,address:'Exact',lat:'91',lon:'6',geo_verified:true}));
 const data=api.payload({...valid,address:'Adresse exacte',lat:'0',lon:'0',geo_verified:true});assert(api.reliableGeo(data.geo));
 assert(!api.reliableGeo({lat:44,lon:6,source:'url_search_center'}));assert(!api.reliableGeo({lat:'44',lon:'6',source:'user_verified'}));
});
function fixture(){
 const dom=new JSDOM('<details id="accommodationPanel"><summary>Hébergement</summary><div id="m58AccommodationList"></div></details><details id="transportPanel"><summary>Transport</summary><div id="m58TransportList"></div></details>',{url:'https://preview.example.org',runScripts:'outside-only'}),w=dom.window;
 w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;};
 const writes=[];
 w.__state={event:{id:'event-a',creator_id:'owner'},user:{id:'owner'},role:'coorganizer'};
 runInContext('let event=__state.event,user=__state.user;',dom.getInternalVMContext());
 w.MyEventReservationLink=api;w.alert=()=>{};w.v58IsEventManager=()=>true;w.v58RenderAccommodationModule=()=>{};w.v58RenderTransportModule=()=>{};w.v58LoadModuleLists=async()=>{};
 w.V58_TRANSPORT_MARKER='[[MYEVENT_TRANSPORT]]';w.V58_ACCOMMODATION_MARKER='[[MYEVENT_ACCOMMODATION]]';
 w.sb={from(table){const q={select(){return q;},eq(){return q;},single:async()=>({data:table==='events'?{id:'event-a',creator_id:'owner'}:{role:w.__state.role}}),insert(data){writes.push(data);q.single=async()=>({data:{id:'message-a'}});return q;}};return q;}};
 w.eval(runtime);w.document.dispatchEvent(new w.Event('DOMContentLoaded'));
 return {dom,w,writes,close:()=>dom.window.close()};
}
test('the same mobile form opens from accommodation and transport; extraction causes no writes or network requests',()=>{
 const f=fixture();try{f.w.fetch=()=>{throw Error('No network allowed');};
 for(const kind of ['accommodation','transport']){f.w.document.querySelector('[data-reservation-link-add="'+kind+'"]').click();f.w.document.getElementById('rlURL').value=url;f.w.document.getElementById('rlExtract').click();assert.equal(f.w.document.getElementById('rlKind').value,kind);assert.equal(f.w.document.getElementById('rlDestination').value,'Gap');f.w.document.getElementById('rlCancel').click();}
 assert.equal(f.writes.length,0);
 }finally{f.close();}
});
test('save persists only after consent, validation and an event-scoped access check',async()=>{
 const f=fixture();try{const w=f.w,d=w.document;w.MyEventReservationLinkUI.open('accommodation');d.getElementById('rlURL').value=url;d.getElementById('rlExtract').click();d.getElementById('rlName').value='Maison choisie';
 const submit=()=>d.getElementById('reservationLinkForm').dispatchEvent(new w.Event('submit',{cancelable:true}));
 submit();await new Promise(r=>setTimeout(r,10));assert.equal(f.writes.length,0);
 d.getElementById('rlConsent').checked=true;submit();await new Promise(r=>setTimeout(r,30));assert.equal(f.writes.length,1);assert.equal(f.writes[0].event_id,'event-a');assert.equal(f.writes[0].user_id,'owner');
 const data=JSON.parse(f.writes[0].content.slice(w.V58_ACCOMMODATION_MARKER.length));assert.equal(data.original_url,url);assert.equal(data.geo,null);assert.equal(data.reservation_status,'added');
 }finally{f.close();}
});
test('event switch and lost coorganizer permission reject persistence',async()=>{
 const f=fixture();try{f.w.__state.event={id:'event-b',creator_id:'other'};f.w.eval('event=__state.event');
 await assert.rejects(f.w.MyEventReservationLinkUI.verifyAccess({eventId:'event-a',userId:'owner'}));
 f.w.sb.from=()=>{const q={select(){return q;},eq(){return q;},single:async()=>({data:{creator_id:'other',role:'member'}})};return q;};
 await assert.rejects(f.w.MyEventReservationLinkUI.verifyAccess({eventId:'event-b',userId:'owner'}));assert.equal(f.writes.length,0);
 }finally{f.close();}
});
test('justificatifs reject active HTML, excessive size and false MIME signatures; accepted bytes are stored privately',async()=>{
 const f=fixture();try{const p=f.w.MyEventReservationLinkUI.proof;
 assert.equal(await p(null),null);
 await assert.rejects(p({type:'text/html',size:12}));await assert.rejects(p({type:'application/pdf',size:200*1024+1}));
 await assert.rejects(p({name:'fake.pdf',type:'application/pdf',size:5,arrayBuffer:async()=>new TextEncoder().encode('<html').buffer}));
 const proof=await p({name:'reservation.pdf',type:'application/pdf',size:5,arrayBuffer:async()=>new TextEncoder().encode('%PDF-').buffer});assert.equal(proof.base64,'JVBERi0=');
 }finally{f.close();}
});
test('imported cards remove the heuristic map action and display safe text and the original link',()=>{
 const f=fixture();try{const d=f.w.document;d.getElementById('m58AccommodationList').innerHTML='<div class="m58ModuleCard"><button data-m58-accommodation-map="0">Carte</button></div>';
 f.w.MyEventReservationLinkUI.cardDecorate([{...api.payload(valid),provider:'<img onerror=evil()>',_message_id:'m'}],'accommodation');
 assert.equal(d.querySelector('[data-m58-accommodation-map]'),null);assert.equal(d.querySelector('.reservationLinkActions a').getAttribute('href'),url);assert.equal(d.querySelector('.reservationLinkActions img'),null);assert.match(d.body.textContent,/aucun repère/);
 }finally{f.close();}
});
test('the real planning timeline renders imported status, original link and no invented midnight time',async()=>{
 const f=fixture();try{const w=f.w;w.$=id=>w.document.getElementById(id);w.esc=v=>String(v||'');w.escAttr=w.esc;w.eur=v=>String(v);w.validSelectedOuting=v=>v;
 w.eval(readFileSync(new URL('../js/planning-transport-runtime.js',import.meta.url),'utf8'));
 w.getEventTransports=async()=>[];w.getEventLocalTravels=async()=>[];w.getEventAccommodations=async()=>[{...api.payload(valid),_message_id:'message-a'}];
 const box=w.document.createElement('div');w.document.body.append(box);
 await w.renderEventPlanningTimeline(box,{id:'event-a'},'manual',null,null,[]);
 assert.match(box.textContent,/Hébergement ajouté/);assert.match(box.textContent,/heure à préciser/);assert.equal(box.querySelector('.reservationLinkActions a').href,url);assert.equal(box.querySelectorAll('.inlineEventTimelineItem').length,2);
 assert(box.querySelector('[data-reservation-link-add]'));
 assert.equal(w.v58AccommodationDate('2026-10-05',true),'05/10/2026 · heure à préciser');
 await w.renderEventAccommodation(box,{id:'event-a'});
 assert.match(box.querySelector('#eventAccommodationList').textContent,/heure à préciser/);
 assert.doesNotMatch(box.querySelector('#eventAccommodationList').textContent,/02:00|00:00/);
 }finally{f.close();}
});
test('map layer only includes verified coordinates and clears them on event changes',async()=>{
 const f=fixture();try{const w=f.w;w.eval('var locationMap={};');const points=[],removed=[];
 w.makeLocationIcon=()=>({});w.L={marker(coords){points.push(coords);const marker={addTo(){return marker;},bindPopup(){return marker;},remove(){removed.push(coords);}};return marker;}};
 const verified=api.payload({...valid,address:'Adresse exacte',lat:'44.5',lon:'6',geo_verified:true});
 w.getEventTransports=async()=>[];w.getEventAccommodations=async()=>[api.payload(valid),verified,{...verified,geo:{lat:44,lon:6,source:'url_search_center'}}];
 await w.MyEventReservationLinkUI.map();assert.equal(points.length,1);assert.deepEqual(Array.from(points[0]),[44.5,6]);
 w.MyEventReservationLinkUI.clearMap();assert.equal(removed.length,1);
 }finally{f.close();}
});

test('proof download rechecks event access, exposes a usable link and revokes it on session changes',async()=>{
 const f=fixture();try{const w=f.w,filters=[],revoked=[],blobs=[];
 w.Blob=Blob;w.URL.createObjectURL=blob=>{blobs.push(blob);return 'blob:https://preview.example.org/proof';};w.URL.revokeObjectURL=url=>revoked.push(url);
 w.HTMLAnchorElement.prototype.click=function(){};
 const item={...api.payload(valid),_message_id:'message-a',proof:{name:'fictif.pdf',type:'application/pdf',base64:'JVBERi0='}};
 w.sb.from=table=>{assert.equal(table,'messages');const q={select(){return q;},eq(k,v){filters.push([k,v]);return q;},single:async()=>({data:{content:w.V58_ACCOMMODATION_MARKER+JSON.stringify(item)}})};return q;};
 const parent=w.document.createElement('div');w.document.body.append(parent);w.MyEventReservationLinkUI.actions(parent,item,'accommodation');parent.querySelector('button').click();await new Promise(r=>setTimeout(r,30));
 assert.deepEqual(filters,[['event_id','event-a'],['id','message-a']]);assert.equal(await blobs[0].text(),'%PDF-');
 const link=parent.querySelector('a[download]');assert.equal(link.textContent,'Enregistrer le justificatif');assert.equal(link.download,'fictif.pdf');
 w.__state.user={id:'outside'};w.eval('user=__state.user');assert.equal(link.dispatchEvent(new w.MouseEvent('click',{cancelable:true})),false);assert.equal(parent.querySelector('a[download]'),null);assert.equal(revoked.length,1);
 // A session change while the database read is pending must not expose bytes.
 w.__state.user={id:'owner'};w.eval('user=__state.user');let resolveRead;
 w.sb.from=()=>{const q={select(){return q;},eq(){return q;},single:()=>new Promise(r=>{resolveRead=r;})};return q;};
 parent.querySelector('button').click();w.__state.user={id:'outside'};w.eval('user=__state.user');resolveRead({data:{content:w.V58_ACCOMMODATION_MARKER+JSON.stringify(item)}});await new Promise(r=>setTimeout(r,30));
 assert.equal(blobs.length,1);assert.match(parent.querySelector('[role="alert"]').textContent,/inaccessible/);
 }finally{f.w.MyEventReservationLinkUI.clearDownloads();f.close();}
});
