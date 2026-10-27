const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {JSDOM}=require('jsdom');
test('social discovery uses shared results beyond catalogue, V3/V2, local filters and social actions without providers',async()=>{
 const old=global.fetch;global.fetch=()=>{throw Error('Real network forbidden');};
 const dom=new JSDOM('<main></main>',{url:'https://fixture.invalid',runScripts:'outside-only'});
 try{
 const catalog=require('../data/restaurant-catalog-gap.json');
 const features=catalog.map((p,i)=>({properties:{place_id:String(i),name:p.name,city:p.city,formatted:p.address,lat:p.coordinates?.[0]??44.559,lon:p.coordinates?.[1]??6.079}}));
 for(let i=20;i<45;i++)features.push({properties:{place_id:String(i),name:'Restaurant fictif '+i,lat:44.559+i/100000,lon:6.079,city:'Gap',formatted:i+' rue fictive'}});
 let providerCalls=0;const data=await require('../lib/geoapify-restaurants').searchRestaurants({lat:44.559,lon:6.079,radius:20},{key:'fixture',fetchImpl:async()=>{providerCalls++;return {ok:true,json:async()=>({features})};}});
 assert.equal(data.results.length,45);assert.equal(data.results.filter(p=>p.restaurant_catalog).length,20);assert.equal(providerCalls,1);
 const w=dom.window;w.HTMLElement.prototype.scrollIntoView=function(){};
 for(const name of ['activities-core','place-card','restaurant-venue-sheet','restaurant-discovery-ui'])w.eval(fs.readFileSync('js/'+name+'.js','utf8'));
 w.fetch=async()=>({ok:true,json:async()=>({})});let calls=0,created;let f={active:true,tab:'discover',city:'',position:{lat:44.559,lon:6.079},radius:20};
 const ui=w.OrevamiRestaurantDiscovery.attach({host:w.document.querySelector('main'),read:()=>f,onCreate:p=>created=p,fetchImpl:async url=>{calls++;const q=new URL(url,'https://fixture.invalid').searchParams;assert.equal(q.get('mode'),'restaurant');assert.equal(q.get('radius'),'20');return {ok:true,json:async()=>data};}});
 await ui.search();assert.equal(calls,1);assert.equal(w.document.querySelectorAll('.restaurantMini').length,45);assert.equal(w.document.querySelectorAll('[data-outing-select]').length,0);
 w.document.querySelector('[data-restaurant-create]').click();assert.equal(created.id,data.results[0].id);
 w.document.querySelector('.restaurantMiniOpenButton').click();assert.ok(w.document.querySelector('dialog.restaurant-v2'));assert.equal(w.document.querySelector('dialog .primary').textContent,'Créer une sortie ici');
 await new Promise(r=>setTimeout(r,10));w.document.querySelector('dialog .primary').click();assert.equal(created.name,data.results[0].name);
 const input=ui.element.querySelector('input');input.value='fictif';input.dispatchEvent(new w.Event('input'));assert.equal(w.document.querySelectorAll('.restaurantMini').length,25);assert.equal(calls,1);await ui.search();assert.equal(calls,1);
 f={...f,active:false};ui.render();assert.equal(ui.element.hidden,true);ui.clear();
 const eventCard=w.MyEventPlaceCard.restaurantMiniature(data.results[0]);assert.match(eventCard,/data-outing-select/);assert.match(eventCard,/Ajouter à l’événement/);
 }finally{dom.window.close();global.fetch=old;}
});
test('activity workspace opens, keeps member outings and prepares the restaurant editor without writes',async()=>{
 const dom=new JSDOM('<button id="activitiesShortcut"></button>',{url:'https://fixture.invalid',runScripts:'outside-only'}),w=dom.window;
 try{
 w.HTMLElement.prototype.scrollIntoView=function(){};w.myeventRuntime={ready:Promise.resolve({environment:'preview',isTest:true,projectRef:'ahyyknfjsielnqyoxqgh'})};
 const member={id:'member-outing',title:'Sortie membre conservée',category:'restaurant',activity_type:'restaurant',city:'Gap',starts_at:'2027-01-01T12:00:00Z',capacity:8,remaining:7,cost_mode:'free',status:'open',position:{lat:44.56,lon:6.08}};
 w.myeventCameraContext=()=>({user:{id:'fixture'},sb:{auth:{onAuthStateChange(){}},rpc:async name=>{assert.ok(['activities_capabilities','activities_list'].includes(name),'No writes');return {data:name==='activities_capabilities'?{enabled:true,adult_access:true}:[member]};}}});
 w.fetch=async url=>{assert.ok(String(url).includes('mode=restaurant'));return {ok:true,json:async()=>({results:[{id:'fixture-restaurant',name:'Restaurant fictif',type:'restaurant',city:'Gap',address:'Rue fictive',lat:44.56,lon:6.08}]})};};
 for(const name of ['activities-core','place-card','activity-venue-sheet','activities-widgets','restaurant-venue-sheet','restaurant-discovery-ui','activities-runtime'])w.eval(fs.readFileSync('js/'+name+'.js','utf8'));
 await new Promise(r=>setTimeout(r,10));await w.myeventOpenActivities();w.document.querySelector('[data-group="food"]').click();
 assert.match(w.document.querySelector('#act-list').textContent,/Sortie membre conservée/);
 // GPS is explicitly provided as a fixture; no real geolocation or geocoder.
 w.navigator.geolocation={getCurrentPosition:callback=>callback({coords:{latitude:44.56,longitude:6.08}})};w.document.querySelector('#act-gps').click();
 [...w.document.querySelectorAll('button')].find(b=>b.textContent==='Rechercher les restaurants').click();await new Promise(r=>setTimeout(r,10));w.document.querySelector('[data-restaurant-create]').click();
 const form=w.document.querySelector('#act-editor form');assert.equal(form.elements.venue.value,'Restaurant fictif');assert.equal(form.elements.activity_type.value,'restaurant');assert.equal(form.elements.latitude.value,'44.56');assert.match(form.textContent,/Lieu ajouté au formulaire/);
 }finally{dom.window.close();}
});
