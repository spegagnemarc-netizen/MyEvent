import test from 'node:test';import assert from 'node:assert/strict';import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{createSabreProvider}=require('../lib/sabre-provider'),{createHandler}=require('../server/search-accommodation');
const q={destination:'Paris',checkIn:'2026-11-10',checkOut:'2026-11-12',guests:2,rooms:1,type:'hotel',lat:48.85341,lon:2.3488};
const env={SABRE_USERNAME:'private-fixture-user',SABRE_PASSWORD:'private-fixture-password'};
test('endpoint URL instead of CERT base is distinguished without disclosing configuration',async()=>{
 const {res,logs}=await run(createSabreProvider({env:{...env,SABRE_API_BASE_URL:'https://api.cert.platform.sabre.com/v5/get/hotelavail'},fetcher:()=>{throw Error('must not fetch');}}));
 assert.equal(res.body.code,'SABRE_CERT_BASE_INVALID');assert.equal(res.body.diagnostics.certOriginAllowed,true);assert.equal(res.body.diagnostics.hotelAvailPath,true);assert.equal(res.body.diagnostics.hasPath,true);assert.doesNotMatch(JSON.stringify([res.body,logs]),/https:|private-fixture/);
});
async function run(provider){const logs=[],res={setHeader(){},status(value){this.statusCode=value;return this;},json(value){this.body=value;return this;}};await createHandler({serviceFactory:()=>provider,logger:{error:(...args)=>logs.push(args)}})({method:'POST',body:q},res);return {res,logs};}
test('invalid CERT base fails before geocoding or OAuth and exposes only format booleans',async()=>{
 const {res,logs}=await run(createSabreProvider({env:{...env,SABRE_API_BASE_URL:' https://api.cert.platform.sabre.com/ '},fetcher:()=>{throw Error('must not fetch');}}));
 assert.equal(res.statusCode,502);assert.equal(res.body.code,'SABRE_CERT_BASE_INVALID');assert.equal(res.body.diagnostics.stage,'configuration');assert.equal(res.body.diagnostics.formattingOnlyMismatch,true);assert.equal(res.body.diagnostics.outerWhitespace,true);
 assert.doesNotMatch(JSON.stringify([res.body,logs]),/https:|private-fixture/);
});
test('OAuth rejection and upstream availability rejection have distinct safe diagnostics',async()=>{
 for(const [status,stage,code] of [[401,'oauth','SABRE_AUTH_HTTP'],[403,'availability','SABRE_AVAIL_HTTP']]){
  const provider=createSabreProvider({env,fetcher:async url=>url.endsWith('/v2/auth/token')&&stage!=='oauth'?{ok:true,json:async()=>({access_token:'private-fixture-token'})}:{ok:false,status,json:()=>{throw Error('upstream body must not be read');}}});
  const {res,logs}=await run(provider);assert.equal(res.statusCode,502);assert.equal(res.body.code,code);assert.equal(res.body.diagnostics.stage,stage);assert.equal(res.body.diagnostics.upstreamHttpStatus,status);assert.doesNotMatch(JSON.stringify([res.body,logs]),/private-fixture/);
 }
});
test('network, malformed JSON and missing token do not expose upstream errors',async()=>{
 for(const [mode,code] of [['network','SABRE_REQUEST_FAILED'],['json','SABRE_INVALID_JSON'],['token','SABRE_AUTH_TOKEN_MISSING']]){
  const {res,logs}=await run(createSabreProvider({env,fetcher:async()=>{if(mode==='network')throw Error('private-fixture-password https://private.example');return {ok:true,json:async()=>{if(mode==='json')throw SyntaxError('private-fixture-token');return {};}};}}));
  assert.equal(res.body.code,code);assert.equal(res.body.diagnostics.stage,'oauth');assert.doesNotMatch(JSON.stringify([res.body,logs]),/private-fixture|private.example/);
 }
});
test('geocoding failure is distinct from OAuth and generic execution exceptions remain private',async()=>{
 const {res}=await run({search:()=>createSabreProvider({env,fetcher:async()=>({ok:false,status:503})}).search({...q,lat:undefined,lon:undefined})});assert.equal(res.body.code,'SABRE_GEOCODING_HTTP');assert.equal(res.body.diagnostics.stage,'geocoding');
 const internal=await run({search:()=>{throw Error('private-fixture-token');}});assert.equal(internal.res.body.code,'SABRE_INTERNAL_ERROR');assert.doesNotMatch(JSON.stringify(internal),/private-fixture/);
});
