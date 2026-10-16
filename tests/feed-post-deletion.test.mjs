import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';
import {createFeedPostDeletion} from '../server/feed-post-deletion-handler.mjs';
const actor='11111111-1111-4111-8111-111111111111',other='22222222-2222-4222-8222-222222222222',id='33333333-3333-4333-8333-333333333333';
const runtime={url:'https://isolated.invalid',publishableKey:'sb_publishable_test'},secret='sb_secret_unit_test_only';
const response=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json'}});
function fixture({admin=false,active=true,rowOwner=actor,path=rowOwner+'/photo-feed.jpg',shared=false,storageFail=false,zero=false,authFail=false}={}){
 const calls=[];
 const fetchImpl=async(url,options={})=>{
  const pathName=new URL(url).pathname,c={url,options};calls.push(c);
  if(pathName==='/auth/v1/user')return response({id:actor,user_metadata:{role:'super_admin'}},authFail?401:200);
  if(pathName.endsWith('/rpc/myevent_admin_identity'))return response({user_id:actor,account_active:active,is_admin:admin,role:admin?'super_admin':null});
  if(pathName.startsWith('/rest/v1/social_posts')||pathName.startsWith('/rest/v1/event_feed_posts')){
   if(options.method==='DELETE')return response(zero?[]:[{id}]);
   if(url.includes('media_path=eq.'))return response(shared?[{id:'another-real-reference'}]:[]);
   return response([{id,user_id:rowOwner,author_id:rowOwner,media_path:path}]);
  }
  if(pathName==='/storage/v1/object/social-media')return storageFail?response({error:'network'},503):response([{name:path}]);
  if(pathName.startsWith('/storage/v1/object/info/'))return response({error:'not found'},404);
  throw Error('Unexpected request '+pathName);
 };
 const handler=createFeedPostDeletion({fetchImpl,environment:()=>runtime,env:{SUPABASE_SECRET_KEY:secret},now:()=>1000});
 const run=async(body={kind:'camera',id},headers={authorization:'Bearer unit-test-token'},method='POST')=>{
  const res={headers:{},setHeader(k,v){this.headers[k]=v;},status(value){this.code=value;return this;},json(value){this.body=value;return this;}};
  await handler({method,headers,body},res);return res;
 };
 return {calls,run};
}
test('unauthenticated and invalid identifiers perform no Supabase request',async()=>{
 const f=fixture();assert.equal((await f.run(undefined,{})).code,401);assert.equal((await f.run({kind:'__proto__',id})).code,400);assert.equal(f.calls.length,0);
});
test('suspended account and expired token cannot delete',async()=>{
 for(const options of [{active:false},{authFail:true}]){const f=fixture(options);assert.ok([401,403].includes((await f.run()).code));assert.ok(!f.calls.some(c=>c.options.method==='DELETE'));}
});
test('user-editable admin metadata cannot authorize another author',async()=>{
 const f=fixture({rowOwner:other});assert.equal((await f.run()).code,403);assert.ok(!f.calls.some(c=>c.options.method==='DELETE'));
});
test('author deletes exact row under RLS, then exact media through Storage API',async()=>{
 const f=fixture(),res=await f.run();assert.deepEqual(res.body,{deleted:true,cleanupPending:false});
 const deletes=f.calls.filter(c=>c.options.method==='DELETE');assert.equal(deletes.length,2);
 assert.equal(deletes[0].options.headers.apikey,runtime.publishableKey);assert.ok(deletes[0].url.includes('user_id=eq.'+actor));
 assert.deepEqual(JSON.parse(deletes[1].options.body),{prefixes:[actor+'/photo-feed.jpg']});
});
test('verified active super_admin may delete another author only at exact ID and owner',async()=>{
 const f=fixture({admin:true,rowOwner:other});assert.equal((await f.run()).body.deleted,true);
 const deletion=f.calls.find(c=>c.options.method==='DELETE');assert.equal(deletion.options.headers.apikey,secret);assert.ok(deletion.url.includes('id=eq.'+id+'&user_id=eq.'+other));
});
test('zero rows deleted never removes a file or reports success',async()=>{
 const f=fixture({zero:true});assert.equal((await f.run()).code,409);assert.ok(!f.calls.some(c=>c.url.includes('/storage/')));
});
test('shared or out-of-owner media is retained',async()=>{
 for(const options of [{shared:true},{path:other+'/photo.jpg'},{path:actor+'/../other.jpg'}]){
  const f=fixture(options);assert.equal((await f.run()).body.deleted,true);assert.ok(!f.calls.some(c=>c.url.includes('/storage/')));
 }
});
test('event publication deletion does not touch the event cover or event',async()=>{
 const f=fixture();assert.deepEqual((await f.run({kind:'event',id})).body,{deleted:true,cleanupPending:false});assert.ok(!f.calls.some(c=>c.url.includes('/storage/')||c.url.includes('/rest/v1/events')));
});
test('failed storage cleanup is explicit and carries only a signed retry receipt',async()=>{
 const f=fixture({storageFail:true}),res=await f.run();assert.equal(res.body.cleanupPending,true);assert.ok(res.body.cleanupReceipt);assert.ok(!JSON.stringify(res.body).includes(secret));
 const bad=await f.run({kind:'camera',id,cleanupReceipt:res.body.cleanupReceipt+'tampered'});assert.equal(bad.code,400);
});
function ui(){
 const dom=new JSDOM('<section id="socialHome"><p id="socialFeedEmpty" hidden></p><div id="socialFeed"><article class="socialPost" data-camera-post-id="'+id+'" data-author-id="'+actor+'"><div class="socialPostHead"></div></article><article class="socialPost" data-event-feed-post="'+other+'" data-author-id="'+other+'"><div class="socialPostHead"></div></article></div></section>',{runScripts:'outside-only'});
 const w=dom.window;w.myeventCameraContext=()=>({user:{id:actor},sb:{rpc:async()=>({data:{user_id:actor,account_active:true,is_admin:false}}),auth:{getSession:async()=>({data:{session:{user:{id:actor},access_token:'test-only'}}})}}});
 w.eval(readFileSync(new URL('../js/feed-post-actions.js',import.meta.url),'utf8'));return dom;
}
test('UI offers deletion only on owned post; cancellation performs no network request',async()=>{
 const dom=ui(),w=dom.window;let requests=0;w.fetch=async()=>{requests++;return response({deleted:true});};w.confirm=()=>false;
 assert.equal(w.document.querySelectorAll('.socialPostDelete').length,1);w.document.querySelector('.socialPostDelete').click();await new Promise(r=>setTimeout(r,0));assert.equal(requests,0);dom.window.close();
});
test('confirmed deletion updates feed and ignores a late stale post response',async()=>{
 const dom=ui(),w=dom.window;w.AbortSignal=AbortSignal;w.confirm=()=>true;w.fetch=async()=>response({deleted:true,cleanupPending:false});
 const original=w.document.querySelector('[data-camera-post-id]').cloneNode(true);original.querySelector('.socialPostMenu').remove();
 w.document.querySelector('.socialPostDelete').click();await new Promise(r=>setTimeout(r,15));assert.equal(w.document.querySelector('[data-camera-post-id]'),null);assert.equal(w.document.getElementById('socialFeedDeleteStatus').textContent,'Publication supprimée.');
 w.document.getElementById('socialFeed').append(original);await new Promise(r=>setTimeout(r,0));assert.equal(w.document.querySelector('[data-camera-post-id]'),null);w.close();
});
