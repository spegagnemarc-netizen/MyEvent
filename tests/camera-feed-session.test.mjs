import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../js/home-social-runtime.js',import.meta.url),'utf8');
const code=source.slice(source.indexOf("  let cameraFeedGeneration="),source.indexOf('  let cameraPublishing=false;'));
function fixture(){
 let owner='',pending=[],posts=[],listener;const notice={textContent:''};
 const feed={querySelectorAll:()=>posts.map(id=>({dataset:{cameraPostId:id},remove(){posts=posts.filter(x=>x!==id);}}))};
 const window={myeventCameraContext:()=>({user:owner?{id:owner}:null}),myeventLoadCameraPosts:()=>new Promise((resolve,reject)=>pending.push({resolve,reject})),addEventListener:(_e,fn)=>listener=fn};
 vm.runInNewContext(code,{window,$s:id=>id==='socialFeed'?feed:notice,renderCameraFeedPost:item=>posts.push(item.id)});
 return {login:id=>{owner=id;return listener();},pending,get posts(){return posts;},notice};
}
test('login after startup loads saved photos; logout/relogin reloads without duplicates',async()=>{
 const f=fixture();assert.equal(f.pending.length,0);let done=f.login('a');f.pending.shift().resolve([{id:'saved'}]);await done;assert.deepEqual(f.posts,['saved']);
 await f.login('');assert.deepEqual(f.posts,[]);done=f.login('a');f.pending.shift().resolve([{id:'saved'}]);await done;assert.deepEqual(f.posts,['saved']);
 done=f.login('a');f.pending.shift().resolve([{id:'saved'}]);await done;assert.deepEqual(f.posts,['saved']);
});
test('late old-account response cannot populate the new account feed',async()=>{
 const f=fixture(),old=f.login('a'),oldRequest=f.pending.shift(),next=f.login('b');f.pending.shift().resolve([{id:'b-photo'}]);await next;oldRequest.resolve([{id:'a-photo'}]);await old;assert.deepEqual(f.posts,['b-photo']);
});
test('load failure is visible and a subsequent login can recover',async()=>{
 const f=fixture();let done=f.login('a');f.pending.shift().reject(Error('private provider detail'));await done;assert.match(f.notice.textContent,/Impossible de recharger/);assert(!f.notice.textContent.includes('private'));await f.login('');done=f.login('a');f.pending.shift().resolve([{id:'saved'}]);await done;assert.deepEqual(f.posts,['saved']);
});
