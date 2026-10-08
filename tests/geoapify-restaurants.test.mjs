import test from 'node:test';import assert from 'node:assert/strict';import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{searchRestaurants,normalizeFeature,deduplicate}=require('../lib/geoapify-restaurants'),card=require('../js/place-card');
const feature=(id,name='Café Étoile',lat=48.85,lon=2.35)=>({geometry:{coordinates:[lon,lat]},properties:{place_id:id,name,formatted:'1 rue Test, Paris',datasource:{raw:{cuisine:'french',opening_hours:'Mo-Fr 12:00-14:00','diet:vegan':'yes',website:'https://example.org'}}}});
test('all four radii use metres and keep the API key on the upstream request only',async()=>{
 for(const radius of [5,20,50,100]){let upstream;const r=await searchRestaurants({lat:48.85,lon:2.35,radius},{key:'test-secret',fetchImpl:async u=>{upstream=u;return {ok:true,json:async()=>({features:[feature('1')]})};}});assert.equal(upstream.searchParams.get('categories'),'catering.restaurant');assert.equal(upstream.searchParams.get('filter'),`circle:2.35,48.85,${radius*1000}`);assert.equal(r.results[0].vegan,'yes');assert.equal(r.results[0].price,null);assert.equal(JSON.stringify(r).includes('test-secret'),false);}
});
test('deduplication covers IDs, accents/address and GPS without merging distant branches',()=>{
 const a=normalizeFeature(feature('1'),48.85,2.35),b={...a,place_id:'2',name:'Cafe Etoile'},c={...a,place_id:'3',address:'Autre adresse',lat:48.8501},d={...a,place_id:'4',address:'Branche éloignée',lat:49};
 assert.equal(deduplicate([a,{...a,name:'Duplicate'},b,c,d]).length,2);
});
test('invalid coordinates and radii are rejected before fetching',async()=>{for(const change of [{lat:null},{lat:91},{lon:181},{radius:3}])await assert.rejects(searchRestaurants({lat:48.85,lon:2.35,radius:5,...change},{key:'test',fetchImpl:()=>{throw Error('must not call');}}),/invalide/);});
test('empty, malformed and timeout responses do not fabricate places or expose upstream URLs',async()=>{
 const q={lat:48.85,lon:2.35,radius:5};assert.deepEqual((await searchRestaurants(q,{key:'test',fetchImpl:async()=>({ok:true,json:async()=>({features:[]})})})).results,[]);
 await assert.rejects(searchRestaurants(q,{key:'test',fetchImpl:async()=>({ok:true,json:async()=>({})})}),/Réponse Geoapify invalide/);
 let attempts=0;await assert.rejects(searchRestaurants(q,{key:'test',fetchImpl:async()=>{attempts++;throw Error('https://provider?apiKey=test');}}),e=>e.message==='Geoapify est temporairement indisponible.');assert.equal(attempts,2);
});
test('cards escape supplier content, suppress unsafe links and omit missing data',()=>{const html=card.content({name:'<script>bad</script>',website:'javascript:alert(1)',image:'data:text/html,bad',price:null,source:'geoapify'});assert.ok(html.includes('&lt;script&gt;'));assert.ok(!html.includes('<script>'));assert.ok(!html.includes('javascript:'));assert.ok(!html.includes('À partir de'));assert.ok(!html.includes('Cuisine'));});
