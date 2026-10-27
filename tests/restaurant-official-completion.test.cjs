const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {JSDOM}=require('jsdom');
test('official completion adds missing facts on demand, preserves catalogue facts/photos, and shares the result',async()=>{
 const dom=new JSDOM('',{url:'https://fixture.invalid',runScripts:'outside-only'}),w=dom.window;
 try{w.eval(fs.readFileSync('js/restaurant-information.js','utf8'));let calls=0;
 const known={status:'available',website:'https://example.org/',opening_hours:[{text:'Horaire catalogue'}],prices:[{text:'Tarif catalogue'}],menus:[{url:'https://example.org/menu'}],booking_links:[],sources:[{url:'https://example.org/catalogue',checked_at:'2026-10-24'}]};
 const venue={id:'fixture',name:'Restaurant fictif',address:'Rue fictive',city:'Ville fictive',lat:44.56,lon:6.08,website:known.website,restaurant_catalog:{information:known,website_verified:true},authorized_photos:[{url:'photo-authorisee'}]};
 w.fetch=async(url,options)=>{calls++;assert.match(String(url),/restaurant-information/);assert.equal(JSON.parse(options.body).venue.name,venue.name);return {ok:true,json:async()=>({status:'available',website_verified:true,website:known.website,description:'Description officielle simulée',phone:'0400000000',opening_hours:[{text:'Autre horaire'}],prices:[{text:'Autre tarif'}],booking_links:[{url:'https://example.org/contact'}],sources:[{url:known.website,checked_at:'2026-10-27'}]})};};
 await w.OrevamiRestaurantInformation.enrich(venue);assert.equal(calls,0,'no list preload');
 const [a,b]=await Promise.all([w.OrevamiRestaurantInformation.load(venue.website,{venue}),w.OrevamiRestaurantInformation.load(venue.website,{venue})]);assert.equal(calls,1);assert.equal(a.description,b.description);assert.equal(a.opening_hours[0].text,'Horaire catalogue');assert.equal(a.prices[0].text,'Tarif catalogue');assert.equal(a.booking_links[0].url,'https://example.org/contact');assert.equal(a.sources.length,2);
 const merged=w.OrevamiRestaurantInformation.applyInformation(venue,a);assert.equal(merged.authorized_photos[0].url,'photo-authorisee');assert.equal(merged.phone,'0400000000');assert.equal(merged.description,'Description officielle simulée');
 const denied=w.OrevamiRestaurantInformation.mergeInformation(known,{website_verified:false,description:'Wrong venue'});assert.equal(denied.description,undefined);
 }finally{dom.window.close();}
});
test('Pasturier description is sourced and all previous catalogue facts remain identical',()=>{
 const cp=require('node:child_process'),before=JSON.parse(cp.execFileSync('git',['show','03095cf:data/restaurant-catalog-gap.json'],{encoding:'utf8'})),after=require('../data/restaurant-catalog-gap.json');
 assert.equal(after.length,20);for(let i=0;i<before.length;i++)for(const key of Object.keys(before[i]))assert.deepEqual(after[i][key],before[i][key]);
 const p=after.find(r=>r.id==='le-pasturier-gap');assert.ok(p.description);assert.match(p.description_source_url,/restaurantlepasturier\.com/);assert.equal(p.description_checked_at,'2026-10-27');
 const enriched=require('../lib/restaurant-catalog').enrichCatalog({name:p.name,city:p.city,address:p.address,lat:p.coordinates[0],lon:p.coordinates[1],type:'restaurant'});assert.equal(enriched.restaurant_information.description,p.description);
});
test('generic name prefix does not block a real brand or official chain, but mismatches are rejected',async()=>{
 const {verifyIdentity}=require('../lib/restaurant-website-identity'),{createSiteSearch}=require('../lib/restaurant-site-search');
 const venue={name:'Le Restaurant la Luye',address:'Boulevard Georges Pompidou',city:'Gap',lat:44.5593504,lon:6.0843392};let reads=0,queries=0;
 const identity={name:'La Luye',address:venue.address,city:'Gap',lat:venue.lat,lon:venue.lon};assert.equal(verifyIdentity(venue,{identity}),true);assert.equal(verifyIdentity(venue,{identity:{...identity,name:'LE RESTAURANT'}}),false);assert.equal(verifyIdentity(venue,{identity:{...identity,city:'Lyon',address:'Autre rue'}}),false);
 const search=createSiteSearch({fetchImpl:async()=>{queries++;return {ok:true,body:new ReadableStream({start(c){c.enqueue(new TextEncoder().encode('<rss><item><link>https://luye.example/restaurant</link></item></rss>'));c.close();}})};},information:async url=>{reads++;return {status:'available',website:url,identity,description:'Description fictive'};}});
 const found=await search(venue);assert.equal(found.website_verified,true);await search(venue);assert.equal(queries,1);assert.equal(reads,1);
 const unrelated=createSiteSearch({fetchImpl:async()=>({ok:true,body:new ReadableStream({start(c){c.enqueue(new TextEncoder().encode('<rss><item><link>https://all.accor.com/hotel/fixture/index.fr.shtml</link></item></rss>'));c.close();}})}),information:async()=>({identity:{...identity,name:'Ibis Kitchen',address:'5/7 Boulevard Georges Pompidou'}})});const rejected=await unrelated(venue);assert.equal(rejected.website,null);assert.equal(rejected.reason,'chain_restaurant_unconfirmed');
});
test('a corroborated site is read before fallback, and unverified raw facts are never imported',async()=>{
 const {verifiedRestaurantInformation}=require('../lib/restaurant-information');const venue={name:'Le Restaurant fictif',address:'Rue fictive',city:'Gap'},fallback={website:'https://example.org/',website_verified:true,status:'available'};let reads=0;
 const a=await verifiedRestaurantInformation(fallback.website,venue,{information:async()=>{reads++;return {identity:{name:'Restaurant fictif',address:venue.address,city:venue.city},description:'Description vérifiée simulée',website:fallback.website};},corroborate:()=>fallback});assert.equal(reads,1);assert.equal(a.description,'Description vérifiée simulée');
 const b=await verifiedRestaurantInformation(fallback.website,venue,{information:async()=>({identity:{name:'Autre lieu'},description:'Incorrect'}),corroborate:()=>fallback});assert.equal(b.description,undefined);
});
