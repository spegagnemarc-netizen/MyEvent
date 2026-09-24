import test from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/camera-ai.js';
import {aiLenses} from '../js/camera-ai-presets.mjs';

const jpeg='data:image/jpeg;base64,/9j/2Q==';
function request(body={},headers={authorization:'Bearer test-session'},method='POST'){
  return {method,headers,body:{lens:'toon',imageData:jpeg,...body}};
}
async function run(req){
  const result={headers:{}};
  const res={setHeader(k,v){result.headers[k]=v;},status(code){result.status=code;return res;},json(body){result.body=body;return res;}};
  await handler(req,res);return result;
}
function mock(t,fetcher){
  const original=globalThis.fetch,key=process.env.OPENAI_API_KEY;
  process.env.OPENAI_API_KEY='test-only';globalThis.fetch=fetcher;
  t.after(()=>{globalThis.fetch=original;if(key===undefined)delete process.env.OPENAI_API_KEY;else process.env.OPENAI_API_KEY=key;});
}
test('reject unsupported method, missing session, unknown lens and malformed photos before network',async t=>{
  mock(t,()=>{throw new Error('Unexpected network');});
  assert.equal((await run(request({},undefined,'GET'))).status,405);
  assert.equal((await run(request({},{}))).status,401);
  for(const body of [{lens:'injected prompt'},{imageData:'data:image/png;base64,AA=='},{imageData:'data:image/jpeg;base64,AAAA'},{imageData:'x'.repeat(3500001)}])assert.equal((await run(request(body))).status,400);
});
test('missing service key returns clear unavailable response',async t=>{
  mock(t,()=>{throw new Error('Unexpected network');});delete process.env.OPENAI_API_KEY;
  assert.equal((await run(request())).status,503);
});
test('invalid or unavailable session never invokes image generation',async t=>{
  let calls=0;mock(t,async()=>{calls++;return {ok:false,status:401};});
  assert.equal((await run(request())).status,401);assert.equal(calls,1);
});
test('all twelve styles send the source photo and a server-owned prompt to image edits',async t=>{
  let edits=0;
  mock(t,async(url,options)=>{
    if(url.includes('/auth/v1/user')){assert.equal(options.headers.authorization,'Bearer test-session');return {ok:true,json:async()=>({id:'user'})};}
    edits++;assert.equal(url,'https://api.openai.com/v1/images/edits');
    assert.equal(options.headers.Authorization,'Bearer test-only');
    assert.equal(options.body.get('model'),'gpt-image-2');
    assert.equal(options.body.get('size'),'auto');
    assert.equal(options.body.get('image[]').type,'image/jpeg');
    assert.equal(options.body.get('image[]').size,4);
    assert(!options.body.get('prompt').includes('CLIENT OVERRIDE'));
    assert(options.body.get('prompt').includes('Preserve the number of people'));
    return {ok:true,json:async()=>({data:[{b64_json:'result'}]})};
  });
  assert.equal(new Set(aiLenses.map(x=>x.id)).size,12);
  for(const lens of aiLenses){const result=await run(request({lens:lens.id,prompt:'CLIENT OVERRIDE'}));assert.equal(result.status,200);assert.equal(result.body.image,'data:image/webp;base64,result');assert.equal(result.headers['Cache-Control'],'no-store');}
  assert.equal(edits,12);
});
test('provider errors and empty images return safe errors',async t=>{
  let status;
  mock(t,async url=>url.includes('/auth/')?{ok:true,json:async()=>({id:'user'})}:{ok:status===200,status,json:async()=>({error:{message:'private provider detail'}})});
  for(status of [429,400,500,200]){
    const result=await run(request());assert.equal(result.status,status===429?429:502);assert(!result.body.error.includes('private'));
  }
});
test('timeout preserves a retryable error',async t=>{
  mock(t,async()=>{throw new DOMException('Timeout','TimeoutError');});
  assert.equal((await run(request())).status,504);
});
