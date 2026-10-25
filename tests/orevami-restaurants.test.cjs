const {test}=require('node:test');const assert=require('node:assert/strict');
const handler=require('../server/orevami-restaurants');
test('restaurant relay refuses production and missing sessions before contacting upstream',async()=>{
 const previous=process.env.VERCEL_ENV;const original=global.fetch;let calls=0;global.fetch=async()=>{calls++;throw Error('unexpected');};
 function response(){return {setHeader(){},status(n){this.code=n;return this;},json(j){this.body=j;return this;}};}
 try{
  process.env.VERCEL_ENV='production';const prod=response();await handler({method:'GET',headers:{}},prod);assert.equal(prod.code,404);assert.equal(calls,0);
  process.env.VERCEL_ENV='preview';process.env.SUPABASE_URL='https://ahyyknfjsielnqyoxqgh.supabase.co';process.env.SUPABASE_PUBLISHABLE_KEY='sb_publishable_local';process.env.MYEVENT_TEST_SUPABASE_REF='ahyyknfjsielnqyoxqgh';
  const anon=response();await handler({method:'GET',headers:{}},anon);assert.equal(anon.code,401);assert.equal(calls,0);
  const cross=response();await handler({method:'POST',headers:{host:'preview.vercel.app',origin:'https://foreign.example'}},cross);assert.equal(cross.code,403);assert.equal(calls,0);
 }finally{global.fetch=original;if(previous===undefined)delete process.env.VERCEL_ENV;else process.env.VERCEL_ENV=previous;}
});
