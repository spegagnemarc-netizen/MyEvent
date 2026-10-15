import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const require = createRequire(import.meta.url);
const places = require('../api/search-places');
const halls = require('../api/search-halls');
const point = (id, category, name, raw = {}, lat = 48.8566, lon = 2.3522) => ({
  geometry: {coordinates: [lon, lat]}, properties: {place_id: id, name, categories: [category], datasource: {raw}}
});
async function run(handler, query = {}, response = () => ({ok:true,json:async()=>({features:[]})})) {
  const savedFetch=globalThis.fetch, savedKey=process.env.GEOAPIFY_API_KEY, calls=[];
  process.env.GEOAPIFY_API_KEY='unit-test-key';
  globalThis.fetch=async url=>{calls.push(new URL(url));return response(new URL(url));};
  const res={headers:{},status(n){this.code=n;return this;},setHeader(k,v){this.headers[k]=v;return this;},json(body){this.body=body;return this;}};
  try {await handler({method:'GET',query:{mode:'nearby',lat:'48.8566',lon:'2.3522',radius:'5',...query}},res);return {...res,calls};}
  finally {globalThis.fetch=savedFetch;if(savedKey===undefined)delete process.env.GEOAPIFY_API_KEY;else process.env.GEOAPIFY_API_KEY=savedKey;}
}
const ok=features=>({ok:true,json:async()=>({features})});
test('5, 10, 20 and 50 km use lon/lat and meters; food and activities cannot exhaust each other',async()=>{
  for(const radius of [5,10,20,50]){
    const r=await run(places,{radius},url=>ok(Array.from({length:100},(_,i)=>point(url.searchParams.get('categories')+'-'+i,url.searchParams.get('categories').startsWith('catering')?'catering.restaurant':url.searchParams.get('categories')==='entertainment'?'entertainment.culture.theatre':'leisure.park',url.searchParams.get('categories')+' Lieu '+i))));
    assert.equal(r.code,200);assert.equal(r.calls.length,3);
    for(const url of r.calls)assert.equal(url.searchParams.get('filter'),`circle:2.3522,48.8566,${radius*1000}`);
    assert(r.calls.some(url=>url.searchParams.get('categories')==='catering.restaurant,catering.fast_food'));
    assert(r.calls.every(url=>!url.searchParams.get('categories').split(',').includes('tourism')));
    assert.equal(r.body.results.filter(x=>x.type==='restaurant').length,75);
    assert.equal(r.body.results.filter(x=>x.type==='theatre').length,50);
    assert.equal(r.body.results.filter(x=>x.type==='park').length,25);
  }
});
test('Geoapify classification, duplicates, unnamed places and out-of-radius points are handled',async()=>{
  const a=point('food','catering.restaurant.french','Restaurant réel',{amenity:'drinking_water'});
  const r=await run(places,{},()=>ok([a,a,point('none','catering.restaurant',''),point('far','catering.restaurant','Trop loin',{},49.9)]));
  assert.equal(r.body.results.length,1);assert.equal(r.body.results[0].type,'restaurant');
});
test('successful empty response stays empty, with a proposed radius; it is not a provider outage',async()=>{
  for(const handler of [places,halls]){const r=await run(handler);assert.equal(r.code,200);assert.equal(r.body.count,0);assert.equal(r.body.nextRadius,10);assert.equal(r.body.error,undefined);}
});
test('auth, quota and outage errors are explicit, not cached, and never contain a key or upstream payload',async()=>{
  for(const handler of [places,halls])for(const [status,code] of [[401,'PROVIDER_AUTH'],[403,'PROVIDER_AUTH'],[429,'PROVIDER_QUOTA'],[500,'PROVIDER_UNAVAILABLE']]){
    const r=await run(handler,{},()=>({ok:false,status,json:async()=>({message:'unit-test-key'})}));
    assert.equal(r.code,503);assert.equal(r.body.code,code);assert.equal(r.body.providerStatus,status);assert.equal(r.headers['Cache-Control'],'no-store');
    assert(!JSON.stringify(r.body).includes('unit-test-key'));
  }
});
test('network/invalid JSON failures stay safe; partial family failure is not reported as zero results',async()=>{
  for(const response of [()=>{throw Error('https://provider?apiKey=unit-test-key');},()=>({ok:true,json:async()=>{throw Error('unit-test-key');}}),url=>url.searchParams.get('categories').startsWith('catering')?ok([point('r','catering.restaurant','Restaurant')]):({ok:false,status:429})]){
    const r=await run(places,{},response);assert.equal(r.code,503);assert(!JSON.stringify(r.body).includes('unit-test-key'));
  }
});
test('invalid coordinates and radii never call a provider',async()=>{
  for(const handler of [places,halls])for(const query of [{lat:''},{lon:' '},{lat:'91'},{radius:999},{radius:'abc'}]){
    const r=await run(handler,query);assert.equal(r.code,400);assert.equal(r.calls.length,0);
  }
});
test('halls use configured Geoapify with strict venue filtering and known capacity/budget only',async()=>{
  const features=[point('hall','activity.events_venue','Domaine réception',{capacity:'100'}),point('community','activity.community_center','Salle polyvalente'),point('sport','activity.events_venue','Salle de sport'),point('school','activity.events_venue','Salle réception',{building:'school'}),point('small','activity.events_venue','Petite salle',{capacity:'10'}),point('cost','activity.events_venue','Réception chère',{price:'1000'}),point('far','activity.events_venue','Salle lointaine',{},50)];
  const r=await run(halls,{radius:50,minCapacity:50,maxBudget:500},()=>ok(features));
  assert.equal(r.code,200);assert.equal(r.calls.length,1);assert.equal(r.calls[0].searchParams.get('categories'),'activity.events_venue,activity.community_center');
  assert.deepEqual(r.body.results.map(x=>x.name),['Domaine réception','Salle polyvalente']);assert.equal(r.body.source,'OpenStreetMap / Geoapify');assert.equal(r.body.results[1].price,null);
});
test('AI candidate limit retains both families and never calls the model when actual results are insufficient',async()=>{
  const src=readFileSync(new URL('../js/sorties-reservations-runtime.js',import.meta.url),'utf8');
  const fn=src.slice(src.indexOf('async function generateAiOutingPlan(){'),src.indexOf('\nfunction renderAiOutingPlans'));
  async function generate(results){
    const nodes={aiPlanGenerate:{disabled:false},aiPlanRadius:{value:'5'},aiPlanSteps:{value:'3'},aiPlanResults:{},aiPlanStatus:{}};let sent;
    const c=vm.createContext({event:{name:'Fictif'},user:{id:'fictif'},$:id=>nodes[id],getActivitySearchCenter:async()=>({lat:48.8566,lon:2.3522}),aiPlanCandidateType:p=>p.type,renderAiOutingPlans(){},sb:{auth:{getSession:async()=>({data:{}})}},fetch:async(url,options)=>{
      if(options?.method==='POST'){sent=JSON.parse(options.body);return {ok:true,json:async()=>({options:[]})};}
      return {ok:true,json:async()=>({results})};
    }});
    vm.runInContext(fn,c);await c.generateAiOutingPlan();return {sent,status:nodes.aiPlanStatus.textContent};
  }
  const food=Array.from({length:120},(_,i)=>({id:'r'+i,name:'Restaurant '+i,type:'restaurant',lat:48.8566,lon:2.3522}));
  const activity=i=>({id:'a'+i,name:'Activité '+i,type:'activity',lat:48.8566,lon:2.3522});
  const r=await generate([...food,activity(1),activity(2)]);assert.equal(r.sent.candidates.length,62);assert.equal(r.sent.candidates.filter(x=>x.type==='activity').length,2);
  const insufficient=await generate(food);assert.equal(insufficient.sent,undefined);assert.match(insufficient.status,/120|60/);assert.match(insufficient.status,/10 km/);
});
