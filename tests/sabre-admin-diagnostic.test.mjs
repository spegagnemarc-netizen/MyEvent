import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync,readdirSync} from 'node:fs';
const require=createRequire(import.meta.url),{createHandler}=require('../server/sabre-admin-diagnostic');
const owner='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',cert='https://api.cert.platform.sabre.com';
const query={action:'compare',destination:'Paris',checkIn:'2026-11-10',checkOut:'2026-11-12',guests:2,rooms:1,type:'hotel',pcc:'S5OM'};
const hotel={HotelInfo:{HotelCode:'fixture-1',HotelName:'Hôtel fictif pour test automatisé'},HotelRateInfo:{RateInfos:{RateInfo:[{CurrencyCode:'EUR',AmountAfterTax:200}]}}};
const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json'}});
function fixture(options={}){
 const calls=[],env={VERCEL_ENV:'preview',SABRE_API_BASE_URL:cert,SABRE_USERNAME:'fixture-user-private',SABRE_PASSWORD:'fixture-password-private',...options.env};
 const fetcher=async(url,init)=>{
  calls.push({url,init});
  if(url.endsWith('/auth/v1/user'))return json({id:options.user||owner},options.userStatus||200);
  if(url.includes('/rpc/'))return json(options.role!==false,options.rpcStatus||200);
  if(url.endsWith('/v2/auth/token'))return json({access_token:'fixture-token-private',expires_in:3600},options.oauthStatus||200);
  return json({GetHotelAvailRS:{ApplicationResults:{status:options.applicationStatus||'Complete',...(options.warn?{Warning:[{SystemSpecificResults:[{Message:[{code:'WARN.0366',content:'fixture-token-private'}]}]}]}:{})},HotelAvailInfos:{HotelAvailInfo:options.empty||options.warn?[]:[hotel]}}},options.availStatus||200);
 };
 const handler=createHandler({env,ownerUserId:owner,fetcher,runtimeLoader:async()=>({supabaseEnvironment:()=>({isTest:true,environment:'preview',url:'https://test.supabase.example',publishableKey:'publishable-fixture',...options.runtime})}),...options.handler});
 async function call(body=query,headers={authorization:'Bearer fixture.session.jwt'},method='POST'){
  const res={headers:{},statusCode:200,setHeader(k,v){this.headers[k]=v;},status(s){this.statusCode=s;return this;},json(value){this.body=value;return this;}};
  await handler({method,headers,body},res);return res;
 }
 return {call,calls};
}
test('production and all non-Preview environments fail closed without network calls',async()=>{
 for(const value of ['production','development','',undefined]){const f=fixture({env:{VERCEL_ENV:value}});assert.equal((await f.call()).statusCode,404);assert.equal(f.calls.length,0);}
});
test('missing session, unconfirmed owner and non-POST fail before external requests',async()=>{
 const f=fixture();assert.equal((await f.call(query,{})).statusCode,401);assert.equal((await f.call(query,{},'GET')).statusCode,405);
 const locked=fixture({handler:{ownerUserId:null}});assert.equal((await locked.call()).body.code,'OWNER_NOT_CONFIRMED');assert.equal(locked.calls.length,0);
});
test('client role claims cannot authorize another user, expired session, missing RPC or suspended account',async()=>{
 for(const options of [{user:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'},{userStatus:401},{role:false},{rpcStatus:404},{runtime:{isTest:false}}]){
  const f=fixture(options),r=await f.call({...query,isAdmin:true,ownerUserId:owner});assert.ok([401,403].includes(r.statusCode));assert.ok(!f.calls.some(c=>c.url.startsWith(cert)));
 }
 const f=fixture({handler:{fetcher:async url=>url.endsWith('/user')?json({id:owner}):json(!url.endsWith('myevent_account_active'))}});assert.equal((await f.call()).statusCode,403);
});
test('both permissions are verified with the caller session, no privileged key',async()=>{
 const f=fixture();await f.call({action:'connection'});
 assert.deepEqual(f.calls.slice(0,3).map(c=>c.url.split('/').pop()),['user','myevent_is_admin','myevent_account_active']);
 for(const call of f.calls.slice(0,3)){assert.equal(call.init.headers.authorization,'Bearer fixture.session.jwt');assert.equal(call.init.headers.apikey,'publishable-fixture');assert.equal(call.init.redirect,'error');}
});
test('exact CERT origin required and configuration failure is not claimed as real Sabre call',async()=>{
 for(const base of [cert+'/',cert+'/v5/get/hotelavail','https://api.platform.sabre.com']){const f=fixture({env:{SABRE_API_BASE_URL:base}}),r=await f.call();assert.equal(r.statusCode,502);assert.equal(r.body.real,false);assert.equal(r.body.code,'SABRE_CERT_BASE_INVALID');assert.ok(!f.calls.some(c=>c.url.startsWith(cert)));}
});
test('connection performs OAuth only and no credentials or token reach response',async()=>{
 const f=fixture(),r=await f.call({action:'connection'});assert.equal(r.statusCode,200);assert.deepEqual(r.body.oauthHttp,[200]);assert.equal(r.body.connection,'connected');assert.equal(r.body.bookingAvailable,false);
 assert.equal(f.calls.filter(c=>c.url.startsWith(cert)).length,1);
 for(const secret of ['fixture-user-private','fixture-password-private','fixture-token-private'])assert.ok(!JSON.stringify(r.body).includes(secret));
});
test('comparison sends separate requests without POS and with S5OM, preserving dates and occupancy',async()=>{
 const f=fixture(),r=await f.call();assert.equal(r.statusCode,200);const requests=f.calls.filter(c=>c.url.endsWith('/v5/get/hotelavail')).map(c=>JSON.parse(c.init.body).GetHotelAvailRQ);
 assert.equal(requests.length,2);assert.equal(requests[0].POS,undefined);assert.deepEqual(requests[1].POS,{Source:{PseudoCityCode:'S5OM'}});
 for(const request of requests){assert.deepEqual(request.SearchCriteria.RateInfoRef.StayDateTimeRange,{StartDate:query.checkIn,EndDate:query.checkOut});assert.deepEqual(request.SearchCriteria.RateInfoRef.Rooms.Room,[{Index:1,Adults:2}]);}
 assert.deepEqual(r.body.cases.map(c=>c.pcc),[null,'S5OM']);assert.equal(r.body.cases[0].hotelCount,1);assert.equal(r.body.cases[0].hotels[0].price,200);assert.equal(r.body.cases[0].hotels[0].currency,'EUR');
});
test('permission errors and WARN.0366 remain explicit; no empty-success disguise',async()=>{
 const permission=await fixture({availStatus:403}).call();assert.equal(permission.body.cases[0].permissionsError,true);assert.deepEqual(permission.body.cases[0].http,[403]);
 const warning=await fixture({warn:true}).call();assert.equal(warning.body.cases[0].status,'unavailable');assert.deepEqual(warning.body.cases[0].warningCodes,['WARN.0366']);assert.deepEqual(warning.body.cases[0].http,[200,200]);assert.ok(!JSON.stringify(warning.body).includes('fixture-token-private'));
 const incomplete=await fixture({warn:true,applicationStatus:'NotProcessed'}).call();assert.deepEqual(incomplete.body.cases[0].warningCodes,['WARN.0366']);assert.equal(incomplete.body.cases[0].code,'SABRE_APPLICATION_INCOMPLETE');
});
test('OAuth refusal and timeout are sanitized; genuine empty response retains zero count',async()=>{
 const refused=await fixture({oauthStatus:401}).call();assert.equal(refused.statusCode,502);assert.deepEqual(refused.body.oauthHttp,[401]);assert.equal(refused.body.permissionsError,true);
 const empty=await fixture({empty:true}).call();assert.equal(empty.body.cases[0].status,'empty');assert.equal(empty.body.cases[0].hotelCount,0);
 const f=fixture({handler:{fetcher:async url=>{if(url.startsWith(cert))throw Error('fixture-token-private');return url.endsWith('/user')?json({id:owner}):json(true);}}});const r=await f.call();assert.equal(r.statusCode,502);assert.ok(!JSON.stringify(r.body).includes('fixture-token-private'));
});
test('input validation blocks arbitrary PCC, past dates, destinations and occupancy',async()=>{
 for(const patch of [{pcc:'OTHER'},{destination:'Gap'},{guests:3},{rooms:2},{checkIn:'2020-01-01'},{checkOut:'2026-11-09'}]){const f=fixture();assert.equal((await f.call({...query,...patch})).statusCode,400);assert.ok(!f.calls.some(c=>c.url.startsWith(cert)));}
});
test('bounded per-instance limiter enforces three diagnostics and resets after ten minutes',async()=>{
 let clock=1000000;const f=fixture({handler:{now:()=>clock}});for(let i=0;i<3;i++)assert.equal((await f.call({action:'connection'})).statusCode,200);
 assert.equal((await f.call({action:'connection'})).statusCode,429);clock+=600000;assert.equal((await f.call({action:'connection'})).statusCode,200);
});
test('session validation is itself bounded against request abuse',async()=>{
 const f=fixture({userStatus:401,handler:{now:()=>1000000}});for(let i=0;i<20;i++)await f.call();assert.equal((await f.call()).statusCode,429);assert.equal(f.calls.length,20);
});
test('shared route requires authentication, server policy is not publicly served, twelve functions remain',async()=>{
 const router=require('../api/[search].js'),saved=process.env.VERCEL_ENV;process.env.VERCEL_ENV='preview';
 try{const res={setHeader(){},status(code){this.code=code;return this;},json(body){this.body=body;}};await router({url:'/api/admin-sabre-diagnostic',method:'POST',headers:{}},res);assert.equal(res.code,401);assert.equal(res.body.code,'AUTH_REQUIRED');}finally{if(saved===undefined)delete process.env.VERCEL_ENV;else process.env.VERCEL_ENV=saved;}
 const config=JSON.parse(readFileSync(new URL('../vercel.json',import.meta.url)));for(const file of ['/server/sabre-admin-policy.json','/server/sabre-admin-diagnostic.js'])assert.ok(config.routes.some(route=>route.status===404&&new RegExp(route.src).test(file)));
 assert.equal(readdirSync(new URL('../api',import.meta.url)).filter(file=>file.endsWith('.js')).length,12);assert.equal(config.functions['api/[search].js'].maxDuration,180);
});
