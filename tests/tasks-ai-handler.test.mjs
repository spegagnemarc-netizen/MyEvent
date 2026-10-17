import {test} from 'node:test';
import assert from 'node:assert/strict';
import {handleTasksAi} from '../server/tasks-ai-handler.mjs';
const env={SUPABASE_URL:'https://ahyyknfjsielnqyoxqgh.supabase.co',SUPABASE_PUBLISHABLE_KEY:'sb_publishable_test',VERCEL_ENV:'preview',MYEVENT_TEST_SUPABASE_REF:'ahyyknfjsielnqyoxqgh',OPENAI_API_KEY:'fixture-not-a-key'};
async function run({authorization='Bearer fixture',providerStatus=200,output,authStatus=200,throwNetwork=false}={}){
 const saved={...process.env},original=global.fetch;Object.assign(process.env,env);let providerCalls=0,payload;
 global.fetch=async(url,options)=>{if(url.includes('/auth/v1/user'))return {ok:authStatus===200};providerCalls++;payload=JSON.parse(options.body);if(throwNetwork)throw new TypeError('network fixture');return{ok:providerStatus===200,status:providerStatus,json:async()=>({output_text:output??JSON.stringify({items:[{title:'Installer les tables',note:'Vérifier la salle'},{title:'installer les tables'},{title:'Accueillir les invités'}]})})};};
 const res={status(n){this.code=n;return this;},json(data){this.data=data;return this;}};
 try{await handleTasksAi({headers:{authorization},body:{people:30,meal:'Buffet dînatoire',details:'En salle'}},res);return{...res,providerCalls,payload};}finally{global.fetch=original;for(const k of Object.keys(process.env))if(!(k in saved))delete process.env[k];Object.assign(process.env,saved);}
}
test('task prompt preserves context, deduplicates and has no assignments/dates',async()=>{const r=await run();assert.equal(r.code,200);assert.equal(r.providerCalls,1);assert.equal(r.data.items.length,2);assert.match(r.payload.input,/Buffet dînatoire/);assert.match(r.payload.input,/En salle/);assert.match(r.payload.input,/30/);assert.deepEqual(Object.keys(r.data.items[0]),['title','note']);});
test('missing or expired session never calls provider',async()=>{assert.equal((await run({authorization:''})).providerCalls,0);const r=await run({authStatus:401});assert.equal(r.code,401);assert.equal(r.providerCalls,0);});
test('quota returns explicit safe message',async()=>{const r=await run({providerStatus:429});assert.equal(r.code,429);assert.match(r.data.error,/limité/);assert.doesNotMatch(r.data.error,/fixture-not-a-key/);});
test('bad response and network error end with explicit errors',async()=>{assert.equal((await run({output:'not json'})).code,502);assert.equal((await run({throwNetwork:true})).code,502);});
test('empty or non-object suggestions are rejected',async()=>{assert.equal((await run({output:'{"items":[null,{},"bad"]}'})).code,502);});
