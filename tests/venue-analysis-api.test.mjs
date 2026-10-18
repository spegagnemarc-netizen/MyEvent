import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),handler=require('../api/search-places.js');
function response(){return {headers:{},status(n){this.statusCode=n;return this;},setHeader(k,v){this.headers[k]=v;},json(body){this.body=body;return this;}};}
test('analysis API rejects production, wrong TEST, invalid payloads and private URLs without network access',async()=>{
 const previous={VERCEL_ENV:process.env.VERCEL_ENV,SUPABASE_URL:process.env.SUPABASE_URL};
 const request={method:'POST',query:{mode:'analyse-venue'},headers:{'content-type':'application/json'},body:{url:'https://127.0.0.1'}};
 try{
  for(const [env,url] of [['production','https://ahyyknfjsielnqyoxqgh.supabase.co'],['preview','https://wrong.supabase.co']]){
   process.env.VERCEL_ENV=env;process.env.SUPABASE_URL=url;const res=response();await handler(request,res);assert.equal(res.statusCode,404);
  }
  process.env.VERCEL_ENV='preview';process.env.SUPABASE_URL='https://ahyyknfjsielnqyoxqgh.supabase.co';
  for(const [extra,expected] of [[{headers:{}},415],[{body:'{'},400],[{body:{url:'x'.repeat(2001)}},400],[{body:null},400],[{},422]]){
   const res=response();await handler({...request,...extra},res);assert.equal(res.statusCode,expected);assert.equal(res.headers['Cache-Control'],'no-store');
  }
 }finally{for(const [k,v] of Object.entries(previous))if(v===undefined)delete process.env[k];else process.env[k]=v;}
});
