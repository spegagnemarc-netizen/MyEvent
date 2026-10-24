const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {JSDOM} = require('jsdom');
const {enrichRestaurant} = require('../lib/restaurant-official-details');
const {searchActivityVenues} = require('../lib/activity-venue-search');
const {venueDetails} = require('../lib/activity-venue-details');
const {normalizeFeature} = require('../lib/geoapify-restaurants');
const card = require('../js/place-card');
const pilot = {id:'osm-node-4744015021', name:'Le pasturier', category:'restaurant', city:'Gap', lat:44.5603045, lon:6.0799698};
const source = 'https://www.restaurantlepasturier.com/';

test('only the identified Gap restaurant receives dated official facts, never slots or a per-person budget', () => {
  const enriched = enrichRestaurant(pilot);
  assert.equal(enriched.website, source);
  assert.equal(enriched.checked_at, '2026-10-24');
  assert.match(enriched.opening_hours, /Fermé dimanche et lundi/);
  assert.match(enriched.prices, /27 €.*35 €.*9,50 €/);
  assert.equal(enriched.booking_method, 'external_request');
  assert.equal(enriched.booking_verified, false);
  assert.equal(enriched.availability, undefined);
  assert.equal(enriched.price, undefined);
  assert.equal(enriched.sources.length, 2);
  for (const sourceRow of enriched.sources) assert.equal(sourceRow.checked_at, '2026-10-24');
  for (const changed of [{name:'Autre restaurant'}, {lat:45}, {lon:7}, {lat:null}, {city:'Paris'}, {id:'osm-node-1'}, {category:'cafe'}]) {
    const other = {...pilot, ...changed};
    assert.equal(enrichRestaurant(other), other);
  }
});

test('existing search, detail refresh and Geoapify all retain the same official snapshot', async () => {
  const feature = {geometry:{coordinates:[pilot.lon,pilot.lat]},properties:{name:pilot.name,osm_type:'N',osm_id:4744015021,osm_key:'amenity',osm_value:'restaurant',city:'Gap'}};
  const search = await searchActivityVenues({q:'Pasturier',city:'Gap'}, {enrich:false, fetchImpl:async u=>({ok:true,json:async()=>({features:u.searchParams.get('layer')?[]:[feature]})})});
  assert.equal(search.results[0].menu_url, source+'carte-tradtionnelle-et-de-saison/');
  const detail = await venueDetails(pilot.id, {fetchImpl:async()=>({ok:true,headers:new Headers(),text:async()=>JSON.stringify({elements:[{type:'node',id:4744015021,lat:pilot.lat,lon:pilot.lon,tags:{name:pilot.name,amenity:'restaurant','addr:city':'Gap'}}]})})});
  assert.deepEqual(detail.venue.sources, search.results[0].sources);
  const geo = normalizeFeature({properties:{name:pilot.name,lat:pilot.lat,lon:pilot.lon,city:'Gap',place_id:'pilot'}},pilot.lat,pilot.lon);
  assert.equal(geo.booking_url, detail.venue.booking_url);
  assert.equal(geo.price, null);
});

test('both existing presentations show sources, menu and request-only booking; saved activity retains attribution', async () => {
  const d = new JSDOM('<main><form><input name="venue"><input name="address"><input name="city"><input name="latitude"><input name="longitude"></form></main>', {url:'https://preview.invalid/',runScripts:'outside-only'});
  try {
    const w=d.window, doc=w.document, enriched=enrichRestaurant(pilot);
    for(const script of ['activities-core','activity-venue-sheet','activities-widgets']) w.eval(fs.readFileSync(path.join(__dirname,'../js',script+'.js'),'utf8'));
    const form=doc.querySelector('form'), finder=w.OrevamiActivitiesWidgets.venueFinder({form});
    form.prepend(finder.element);
    const sheet=w.OrevamiVenueSheet.create({host:doc.querySelector('main'), onAdd:()=>{}, onAnalyse:()=>{}});
    await sheet.open(enriched,{load:false});
    assert.match(sheet.element.textContent,/24\/10\/2026/);
    assert.match(sheet.element.textContent,/27 €.*35 €.*9,50 €/);
    const link=sheet.element.querySelector('a[href="'+enriched.booking_url+'"]');
    assert.match(link.textContent,/Demander une réservation/);
    assert.ok(sheet.element.querySelector('a[href="'+enriched.menu_url+'"]'));
    assert.ok(![...sheet.element.querySelectorAll('button,a')].some(n=>/^🎟️ Réserver$|^Réserver$/.test(n.textContent)));
    finder.restore(enriched);
    assert.equal(finder.snapshot.menu_url,enriched.menu_url);
    assert.equal(finder.snapshot.booking_method,'external_request');
    assert.equal(finder.snapshot.sources[0].checked_at,'2026-10-24');
    const wrapper=doc.createElement('div');wrapper.innerHTML=card.content(enriched);
    assert.match(wrapper.textContent,/24\/10\/2026/);
    assert.match(wrapper.textContent,/Aucune disponibilité fournie/);
    assert.equal(wrapper.querySelectorAll('a[href="'+enriched.menu_url+'"]').length,2);
    sheet.enrich({name:'Autre lieu',website:'https://example.org/',opening_hours:[],prices:[],conditions:[],sources:[]});
    assert.equal(sheet.current.official_restaurant,null);
    finder.destroy();sheet.destroy();
  } finally { d.window.close(); }
});
