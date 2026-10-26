import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createAdSenseAdapter,createAdMobAdapter} from '../js/ads-providers.mjs';
test('private document cannot mount any advertising SDK, even with all approval flags',()=>{
 const scope=new Proxy({}, {get(){throw Error('No window, document, storage or network access allowed');}});
 for(const environment of ['preview','production']){
  const adapter=createAdSenseAdapter({environment,productionAuthorized:true,isolationApproved:true,publisherId:'ca-pub-1234567890123456',slotId:'1234567890',certifiedCmpId:300},scope);
  assert.equal(adapter.available(),false);assert.equal(adapter.initialize(),false);assert.equal(adapter.mount({}),false);adapter.destroy();assert.match(adapter.reason,/document privé/);
 }
 assert.equal(createAdMobAdapter().available,false);
});
test('private adapter contains no dormant advertising loader',()=>{
 const source=readFileSync(new URL('../js/ads-providers.mjs',import.meta.url),'utf8');
 assert(!/createElement|adsbygoogle|googlesyndication|fetch\s*\(|import\s*\(/.test(source));
});
