import test from 'node:test';import assert from 'node:assert/strict';import {createRequire} from 'node:module';const require=createRequire(import.meta.url);const {validate}=require('../js/accommodation-search-contract');const handler=require('../server/search-accommodation');const {createAccommodationService}=require('../lib/accommodation-provider');
const q={destination:'Paris',checkIn:'2099-01-02',checkOut:'2099-01-03',guests:2,rooms:1,type:'all'};
test('valid search and invalid dates/counts',()=>{assert.equal(validate(q),'');for(const change of [{destination:''},{checkIn:'2099-02-31'},{checkIn:'2000-01-01'},{checkOut:q.checkIn},{guests:0},{guests:1.5},{guests:31},{rooms:3},{rooms:0},{type:'unknown'}])assert.ok(validate({...q,...change}));});
test('Paris 5–7 October 2026 is valid without relying on Safari date parsing',()=>{
  const stay={...q,checkIn:'2026-10-05',checkOut:'2026-10-07'};
  const OriginalDate=globalThis.Date;
  try{
    globalThis.Date=class {constructor(){throw new Error('The string did not match the expected pattern.')}};
    assert.equal(validate(stay,'2026-10-04'),'');
    assert.match(validate({...stay,checkIn:'2026-02-29'},'2026-10-04'),/dates valides/);
    assert.equal(validate({...stay,checkIn:'2028-02-29',checkOut:'2028-03-01'},'2026-10-04'),'');
  }finally{globalThis.Date=OriginalDate;}
});
async function request(method,body){let status=200,data;const headers={};await handler({method,body},{setHeader(k,v){headers[k]=v;},status(v){status=v;return this;},json(v){data=v;return this;}});return {status,data,headers};}
test('no authorized supplier means no offers, prices or links',async()=>{const r=await request('POST',q);assert.equal(r.status,200);assert.equal(r.data.status,'unavailable');assert.deepEqual(r.data.results,[]);assert.equal(r.headers['Cache-Control'],'no-store');});
test('endpoint rejects invalid inputs and GET',async()=>{assert.equal((await request('GET',q)).status,405);assert.equal((await request('POST',{...q,guests:0})).status,400);});
test('supplier can be replaced without changing query',async()=>{let received;const service=createAccommodationService({async search(query){received=query;return {status:'empty',results:[],warnings:[]};}});assert.equal((await service.search(q)).status,'empty');assert.equal(received,q);});
