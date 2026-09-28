import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const server=readFileSync(new URL('../api/search-places.js',import.meta.url),'utf8');
const core=readFileSync(new URL('../js/core-runtime.js',import.meta.url),'utf8');
const outings=readFileSync(new URL('../js/sorties-reservations-runtime.js',import.meta.url),'utf8');
const productUrl='https://www.viator.com/tours/Gap/Example/d1-TEST?pid=P000TEST&mcid=42383&campaign=my-event';
const product={productCode:'TEST',title:'Sortie test',description:'Une description',productUrl,
  pricing:{summary:{fromPrice:24.5},currency:'EUR'},images:[{variants:[{width:720,url:'https://example.com/photo.jpg'}]}],
  reviews:{combinedAverageRating:4.7,totalReviews:51}};
function api(env={},products=[product]) {
  const calls=[];
  const context=vm.createContext({module:{exports:{}},process:{env:{VIATOR_API_ENV:'production',VIATOR_API_KEY:'test-production',VIATOR_API_KEY_SANDBOX:'test-sandbox',...env}},
    AbortController,setTimeout,clearTimeout,URL,console:{error(){}},fetch:async(url,options)=>{
      calls.push({url,options});
      if(url.endsWith('/destinations'))return {ok:true,json:async()=>({destinations:[{destinationId:7,name:'Gap',center:{latitude:44.56,longitude:6.08}}]})};
      if(url.endsWith('/products/search'))return {ok:true,json:async()=>({products,totalCount:products.length})};
      return {ok:false,status:404,json:async()=>({message:'Invalid endpoint'})};
    }});
  vm.runInContext(server,context);
  const run=async(query={})=>{const res={status(n){this.code=n},setHeader(){},json(body){this.body=body}};
    await context.module.exports({method:'GET',query:{mode:'viator',lat:'44.5612032',lon:'6.0820639',count:'30',...query}},res);return res;};
  return {calls,run,context};
}
test('production: official GET destinations + POST products, production key, headers and payload',async()=>{
  const a=api();const r=await a.run({maxPrice:'50'});assert.equal(r.code,200);
  assert.deepEqual(a.calls.map(x=>x.url),['https://api.viator.com/partner/destinations','https://api.viator.com/partner/products/search']);
  assert.deepEqual(a.calls.map(x=>x.options.method),['GET','POST']);
  for(const {options} of a.calls){assert.equal(options.headers['exp-api-key'],'test-production');assert.equal(options.headers.Accept,'application/json;version=2.0');assert.equal(options.headers['Content-Type'],'application/json;version=2.0');assert.equal(options.headers['Accept-Language'],'fr');}
  assert.deepEqual(JSON.parse(a.calls[1].options.body),{filtering:{destination:'7',highestPrice:50},sorting:{sort:'DEFAULT'},pagination:{start:1,count:30},currency:'EUR'});
  const p=r.body.results[0];assert.equal(p.website,productUrl);assert.equal(p.productUrl,productUrl);
  for(const [k,v] of Object.entries({name:product.title,description:product.description,price:24.5,rating:4.7,reviewCount:51,image:'https://example.com/photo.jpg',source:'viator'}))assert.equal(p[k],v);
  assert.ok(!JSON.stringify(r.body).includes('test-production'));
});
test('production without production key never falls back to sandbox',async()=>{
  const a=api({VIATOR_API_KEY:''});assert.equal((await a.run()).code,502);assert.equal(a.calls.length,0);
});
test('sandbox remains isolated, including destination cache after environment change',async()=>{
  const a=api({VIATOR_API_ENV:'sandbox'});await a.run();assert.ok(a.calls.every(c=>c.url.startsWith('https://api.sandbox.viator.com/partner/')));
  assert.ok(a.calls.every(c=>c.options.headers['exp-api-key']==='test-sandbox'));
  a.context.process.env.VIATOR_API_ENV='production';await a.run();assert.equal(a.calls[2].url,'https://api.viator.com/partner/destinations');
});
test('missing price stays unknown, count bounded, missing coordinates rejected',async()=>{
  const a=api({},[{...product,pricing:{summary:{fromPrice:null}}}]);const r=await a.run({count:'999'});
  assert.equal(r.body.results[0].price,null);assert.equal(JSON.parse(a.calls[1].options.body).pagination.count,50);
  assert.equal((await a.run({lat:'invalid'})).code,400);
});
test('upstream failures stay explicit, never fall back to Photon or expose upstream payload',async()=>{
  const a=api();a.context.fetch=async()=>({ok:false,status:403,json:async()=>({message:'sensitive upstream data'})});
  const r=await a.run();assert.equal(r.code,403);assert.equal(r.body.error,'Viator HTTP 403 (/destinations)');
});

function navigationSource(source=core){
  const card=source.slice(source.indexOf('    eventListEl.onclick=async ev=>{'),source.indexOf('  // V54.32')).trim().replace(/\}\s*$/, '');
  const start=source.indexOf('    const updateChoice=async(next)=>{');
  const end=source.indexOf('    if(choice===\'ai\'&&typeof renderAiPlanReservations',start);
  return {card,choice:source.slice(start,end)};
}
test('inner controls no longer reach card collapse; header still collapses',async()=>{
  let removed=0;const card={dataset:{eventId:'A'},querySelector:s=>s==='.inlineEventDetails'?{remove(){removed++}}:null,classList:{add(){}}};
  const c=vm.createContext({event:{id:'A'},eventListEl:{contains:()=>true},eventCardClickLockUntil:0,document:{querySelectorAll:()=>[]},Date});
  vm.runInContext(navigationSource().card,c);
  await c.eventListEl.onclick({target:{closest:s=>s==='.inlineEventDetails'?{}:card}});assert.equal(removed,0);assert.equal(c.event.id,'A');
  await c.eventListEl.onclick({target:{closest:s=>s==='.eventCard'?card:null}});assert.equal(removed,1);
});
test('manual opens outings for same event, late read cannot reopen another event',async()=>{
  let handler,resolveRead;const opened=[];
  const c=vm.createContext({event:{id:'A'},choice:'ai',choiceKey:'test',renderToken:1,inlineEventRenderToken:1,outing:null,content:{},aiPlan:null,aiItems:[],
    planning:{querySelectorAll:()=>[{dataset:{eventPlanningChoice:'manual'},classList:{toggle(){}},addEventListener:(type,fn)=>handler=fn}],querySelector:()=>null},
    localStorage:{setItem(){}},getScopedEventOuting:()=>new Promise(r=>resolveRead=r),showEventTab:(...a)=>opened.push(a),renderManual:()=>'',renderAi:()=>'',bindPlanningActions(){},box:{querySelector:()=>null},renderEventPlanningTimeline:async()=>{},refreshReservationBoxes:async()=>{}});
  vm.runInContext(navigationSource().choice,c);
  let stopped=false;handler({preventDefault(){},stopPropagation(){stopped=true}});resolveRead(null);await new Promise(r=>setImmediate(r));
  assert.ok(stopped);assert.deepEqual(opened,[['outings',true]]);assert.equal(c.event.id,'A');
  handler({preventDefault(){},stopPropagation(){}});c.event={id:'B'};resolveRead(null);await new Promise(r=>setImmediate(r));assert.equal(opened.length,1);
});
test('client search only calls Viator and retains affiliate URL; stale response discarded',async()=>{
  const start=outings.indexOf('async function searchOutings(){');const end=outings.indexOf('\n(function(){',start);
  const calls=[];let responseResolve;const c=vm.createContext({event:{id:'A'},outingSearchVersion:0,outingResultsData:[],getActivitySearchCenter:async()=>({lat:44.56,lon:6.08}),$:()=>({value:'5'}),fetch:async url=>{calls.push(url);return new Promise(r=>responseResolve=r)},renderOutingResults(){},loadSelectedOuting:async()=>{},msg(){}});
  vm.runInContext(outings.slice(start,end),c);let pending=c.searchOutings();await new Promise(r=>setImmediate(r));responseResolve({ok:true,json:async()=>({results:[{...product,name:product.title,website:productUrl,lat:44.56,lon:6.08}]})});await pending;
  assert.equal(calls.length,1);assert.match(calls[0],/^\/api\/search-places\?mode=viator&/);assert.equal(c.outingResultsData[0].website,productUrl);
  pending=c.searchOutings();await new Promise(r=>setImmediate(r));c.event={id:'B'};responseResolve({ok:true,json:async()=>({results:[]})});await pending;assert.equal(c.outingResultsData.length,1);
});
