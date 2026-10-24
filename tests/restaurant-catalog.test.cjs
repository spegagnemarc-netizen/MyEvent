const {test}=require('node:test');
const assert=require('node:assert/strict');
const records=require('../data/restaurant-catalog-gap.json');
const {enrichRestaurant}=require('../lib/restaurant-official-details');
const card=require('../js/place-card');
test('20 unique public records; no photos or invented availability',()=>{
 assert.equal(records.length,20); assert.equal(new Set(records.map(r=>r.id)).size,20);
 for(const r of records){
  assert.equal(r.photo,null);assert.ok(r.sources.length);
  for(const s of r.sources){assert.equal(s.checked_at,'2026-10-24');assert.equal(new URL(s.url).protocol,'https:');}
  const [lat,lon]=r.coordinates||[44.55907,6.07967];
  const venue={id:'geoapify-test',name:r.name,address:r.address,city:r.city,type:'restaurant',lat,lon,image:'https://maps.google.com/photo'};
  const enriched=enrichRestaurant(venue);assert.equal(enriched.restaurant_catalog.id,r.id);
  assert.equal(enriched.id,venue.id);assert.equal(enriched.lat,lat);assert.equal(enriched.booking_verified,false);
  assert.equal(enriched.image,null);assert.equal(enriched.restaurant_catalog.information.availability.status,'not_provided');
  const html=card.accordion(enriched);assert.doesNotMatch(html,/<details[^>]*\sopen[\s>]/);assert.match(html,/restaurant_catalog/);
 }
});
test('homonyms, distant results, wrong addresses and unsupported categories are not enriched',()=>{
 const v={id:'geoapify-1',name:'Le GM',address:'8 rue du Docteur Roubaud',city:'Gap',lat:44.55907,lon:6.07967,type:'restaurant'};
 for(const change of [{name:'Other'},{address:'9 rue du Docteur Roubaud'},{city:'Paris'},{lat:45},{lat:null},{type:'hotel'},{category:'cafe'}]){const candidate={...v,...change};assert.equal(enrichRestaurant(candidate),candidate);}
});
test('opening a catalogue accordion shows dated sources and warnings without scraping',async()=>{
 const {JSDOM}=require('jsdom'),fs=require('node:fs'),path=require('node:path');
 const d=new JSDOM('<main></main>',{url:'https://preview.invalid/',runScripts:'outside-only'});
 try{
  const w=d.window;w.fetch=()=>{throw Error('Unexpected network request');};
  w.eval(fs.readFileSync(path.join(__dirname,'../js/restaurant-information.js'),'utf8'));
  const r=records.find(r=>r.id==='gm-gap');
  const venue=enrichRestaurant({id:'geoapify-1',name:r.name,address:r.address,city:'Gap',lat:44.55907,lon:6.07967,type:'restaurant'});
  w.document.querySelector('main').innerHTML=card.accordion(venue);
  const accordion=w.document.querySelector('details');assert.equal(accordion.open,false);
  accordion.open=true;accordion.dispatchEvent(new w.Event('toggle'));
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(accordion.dataset.loaded,'true');assert.match(accordion.textContent,/lecture directe bloquée/);
  assert.match(accordion.textContent,/24\/10\/2026/);assert.match(accordion.textContent,/aucun partenariat/);
  assert.ok(accordion.querySelector('[data-restaurant-details]'));
 }finally{d.window.close();}
});
