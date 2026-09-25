import test from 'node:test';
import assert from 'node:assert/strict';
import {validateListing,filterListings,createMarketplaceStore} from '../js/marketplace-data.mjs';
const fields={title:'Enceinte portable',description:'Enceinte en bon état, chargeur et housse inclus.',city:'Lyon',price:'35.90',mode:'rent',category:'sound',condition:'good'};
test('listing validation preserves cents and rejects incomplete or invalid listings',()=>{
  assert.equal(validateListing(fields).price_cents,3590);
  for(const changes of [{price:'NaN'},{price:'1.001'},{price:'0'},{mode:'free'},{category:'invalid'},{condition:'broken'},{title:'a'},{description:'court'},{city:''}])assert.throws(()=>validateListing({...fields,...changes}));
  assert.equal(validateListing({...fields,title:'  Enceinte portable  '}).title,'Enceinte portable');
});
test('search combines accent-insensitive words, city, category, transaction and favorites',()=>{
  const items=[{id:'1',...validateListing(fields),created_at:'2026-01-01'}, {id:'2',...validateListing({...fields,title:'Éclairage de soirée',category:'lights',mode:'sale',price:100,city:'Paris'}),created_at:'2026-01-02'}];
  assert.deepEqual(filterListings(items,{query:'eclairage soiree',city:'paris'}).map(x=>x.id),['2']);
  assert.equal(filterListings(items,{mode:'rent',category:'lights'}).length,0);
  assert.deepEqual(filterListings(items,{favorites:new Set(['1'])}).map(x=>x.id),['1']);
  assert.deepEqual(filterListings(items,{sort:'priceDesc'}).map(x=>x.id),['2','1']);
  assert.deepEqual(items.map(x=>x.id),['1','2']);
});
test('storage and database errors are surfaced; no optimistic success is returned',async()=>{
  const error={message:'RLS denied'};const store=createMarketplaceStore({from(){return {insert(){return {select(){return {single:async()=>({error})};}}}};}});
  await assert.rejects(store.create(fields),e=>e===error);
});
test('listing reads paginate through server row cap',async()=>{
  const calls=[];const query={select(){return this;},order(){return this;},eq(){return this;},async range(a,b){calls.push([a,b]);return {data:Array.from({length:a===0?200:1},(_,i)=>({id:a+i}))};}};
  const rows=await createMarketplaceStore({from:()=>query}).listings();assert.equal(rows.length,201);assert.deepEqual(calls,[[0,199],[200,399]]);
});
