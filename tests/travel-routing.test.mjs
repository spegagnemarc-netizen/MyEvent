import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync, readdirSync} from 'node:fs';
const require = createRequire(import.meta.url);
const router = require('../api/[search].js');
const accommodation = require('../server/search-accommodation');
const transport = require('../server/search-transport');

const stay = {destination:'Paris',checkIn:'2099-01-02',checkOut:'2099-01-03',guests:2,rooms:1,type:'all'};
const journey = {from:'Paris',to:'Lyon',date:'2099-01-02',passengers:2};
async function request(handler, req) {
  const response = {status:200,headers:{},body:undefined};
  await handler(req, {
    setHeader(k,v){response.headers[k]=v;},
    status(n){response.status=n;return this;},
    json(v){response.body=v;return this;}
  });
  return response;
}

test('both public paths preserve methods, bodies, headers and query without mutation', async () => {
  for (const [path, original, body] of [['search-accommodation',accommodation,stay],['search-transport',transport,journey]]) {
    for (const method of ['GET','HEAD','OPTIONS','PUT','DELETE','POST']) {
      const req = {url:`/api/${path}?search=search-accommodation&runtime_config=1`,method,
        body:{...body,mode:'bus'},headers:{authorization:'Bearer test-only'},query:{search:'search-accommodation',runtime_config:'1'}};
      const snapshot = structuredClone(req);
      assert.deepEqual(await request(router,req),await request(original,req));
      assert.deepEqual(req,snapshot);
    }
  }
});

test('accommodation validation and disabled provider retain exact status, headers and payload',async()=>{
  for (const body of [stay,{},null,{...stay,guests:0},{...stay,checkOut:stay.checkIn}]) {
    const req={url:'/api/search-accommodation',method:'POST',body};
    assert.deepEqual(await request(router,req),await request(accommodation,req));
  }
});

test('query parameters never choose a handler or make unknown routes callable',async()=>{
  for (const url of ['/api/unknown?search=search-transport','/api/search-accommodation/extra','/api/[search]','/api/%73earch-transport','/api/__proto__']) {
    assert.equal((await request(router,{url,method:'POST',body:journey,query:{search:'search-transport'}})).status,404);
  }
});

test('legacy .js aliases retain behavior',async()=>{
  for (const path of ['search-accommodation','search-transport']) {
    assert.deepEqual(await request(router,{url:`/api/${path}.js`,method:'GET'}),await request(router,{url:`/api/${path}`,method:'GET'}));
  }
});

test('transport unavailable providers, external links and invalid requests preserve responses',async()=>{
  const keys=['SNCF_API_TOKEN','AMADEUS_CLIENT_ID','AMADEUS_CLIENT_SECRET'];
  const saved=keys.map(k=>process.env[k]);const previousFetch=globalThis.fetch;
  try {
    keys.forEach(k=>delete process.env[k]);
    globalThis.fetch=()=>{throw Error('Unexpected provider request');};
    for(const mode of ['all','train','plane','bus','carpool','taxi','unknown']) {
      const req={url:'/api/search-transport',method:'POST',body:{...journey,mode}};
      assert.deepEqual(await request(router,req),await request(transport,req));
    }
    assert.equal((await request(router,{url:'/api/search-transport',method:'POST',body:{}})).status,400);
    const result=await request(router,{url:'/api/search-transport',method:'POST',body:{...journey,mode:'all'}});
    assert.equal(result.body.results.length,3);
    assert(result.body.results.every(r=>r.external_only&&r.price===null));
  } finally {globalThis.fetch=previousFetch;keys.forEach((k,i)=>{if(saved[i]===undefined)delete process.env[k];else process.env[k]=saved[i];});}
});

test('SNCF authorized provider is called with original headers and response mapping',async()=>{
  const saved=process.env.SNCF_API_TOKEN, previousFetch=globalThis.fetch;const calls=[];
  try {
    process.env.SNCF_API_TOKEN='fixture-only';
    globalThis.fetch=async(url,options)=>{
      calls.push({url,options});
      return {ok:true,json:async()=>String(url).includes('/places?')?{places:[{id:'stop_area:fixture',name:'Fixture',embedded_type:'stop_area'}]}:
        {journeys:[{id:'fixture',departure_date_time:'20990102T060000',arrival_date_time:'20990102T080000',duration:7200,sections:[]}]}};
    };
    const req={url:'/api/search-transport',method:'POST',body:{...journey,mode:'train'}};
    const routed=await request(router,req);const routedCalls=calls.splice(0);
    assert.deepEqual(routed,await request(transport,req));assert.deepEqual(routedCalls,calls);
    assert.equal(routed.body.results[0].provider,'SNCF');assert.equal(routed.body.results[0].duration_minutes,120);
    assert.equal(calls[0].options.headers.Authorization,'Basic '+Buffer.from('fixture-only:').toString('base64'));
    globalThis.fetch=async()=>{throw Error('fixture failure');};
    assert.deepEqual(await request(router,req),await request(transport,req));
  }finally{globalThis.fetch=previousFetch;if(saved===undefined)delete process.env.SNCF_API_TOKEN;else process.env.SNCF_API_TOKEN=saved;}
});

test('Amadeus authentication, city lookup and flight mapping retain behavior',async()=>{
  const keys=['AMADEUS_CLIENT_ID','AMADEUS_CLIENT_SECRET'];const saved=keys.map(k=>process.env[k]);
  const previousFetch=globalThis.fetch,calls=[];
  try {
    process.env.AMADEUS_CLIENT_ID='fixture-id';process.env.AMADEUS_CLIENT_SECRET='fixture-secret';
    globalThis.fetch=async(url,options)=>{
      calls.push({url,headers:options.headers,body:options.body?.toString()});
      const data=String(url).includes('/token')?{access_token:'fixture-token'}:String(url).includes('/locations?')?
        {data:[{iataCode:'PAR',name:'Fixture'}]}:{data:[{id:'flight',price:{total:'120',currency:'EUR'},itineraries:[{duration:'PT2H',segments:[{carrierCode:'AF',number:'1',departure:{iataCode:'PAR',at:'2099-01-02T06:00:00'},arrival:{iataCode:'LYS',at:'2099-01-02T08:00:00'}}]}]}]};
      return {ok:true,json:async()=>data};
    };
    const req={url:'/api/search-transport',method:'POST',body:{...journey,mode:'plane'}};
    const routed=await request(router,req),routedCalls=calls.splice(0);
    assert.deepEqual(routed,await request(transport,req));assert.deepEqual(routedCalls,calls);
    assert.equal(routed.body.results[0].price,120);assert.equal(routed.body.results[0].duration_minutes,120);
    globalThis.fetch=async()=>({ok:false,status:401,json:async()=>({error_description:'fixture auth failure'})});
    assert.deepEqual(await request(router,req),await request(transport,req));
  }finally{globalThis.fetch=previousFetch;keys.forEach((k,i)=>{if(saved[i]===undefined)delete process.env[k];else process.env[k]=saved[i];});}
});

test('deployment stays within Hobby budget; runtime-config and raw Stripe body config remain separate',()=>{
  const functions=readdirSync(new URL('../api/',import.meta.url)).filter(p=>p.endsWith('.js'));
  assert.equal(functions.length,12);assert(functions.includes('stripe-webhook.js'));
  const config=JSON.parse(readFileSync(new URL('../vercel.json',import.meta.url),'utf8'));
  assert.deepEqual(config.routes.find(r=>r.src==='^/api/runtime-config$'),{src:'^/api/runtime-config$',dest:'/api/camera-ai?runtime_config=1'});
  assert.equal(config.routes[0].status,404);
  for(const path of ['/server/search-accommodation.js','/server/search-transport.js'])assert(new RegExp(config.routes[0].src).test(path));
  assert.equal(require('../api/stripe-webhook').config.api.bodyParser,false);
  const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
  assert(html.includes('data-omio-widget="true"'));assert(html.includes('https://www.omio.com/gcs-proxy/b2b-nemo-prod/bundle/fr/bundle.js'));
});
