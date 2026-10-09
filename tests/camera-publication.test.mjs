import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const core=readFileSync(new URL('../js/core-runtime.js',import.meta.url),'utf8');
const attach=core.slice(core.indexOf('window.myeventAttachCameraPhoto=async'),core.indexOf('\nasync function uploadMedia()'));
function harness(insertError=null){
 const writes=[],removed=[];
 const sb={from:table=>table==='events'?{select:()=>({eq:()=>({maybeSingle:async()=>({data:{id:'event'}})})})}:{insert:row=>{writes.push(row);return {select:()=>({single:async()=>({data:{id:'media'},error:insertError})})};}},storage:{from:()=>({upload:async(path,blob,options)=>{writes.push({path,type:blob.type,options});return {};},remove:async paths=>removed.push(...paths)})}};
 const context={window:{},Blob,fetch:async()=>({blob:async()=>new Blob(['jpeg'],{type:'image/jpeg'})}),user:{id:'user'},sb,crypto:{randomUUID:()=> 'uuid'},rememberLocalCreated:()=>{},event:null};
 vm.runInNewContext(attach,context);return {...context,writes,removed};
}
test('event video keeps MIME, extension and video type without changing schema',async()=>{
 const h=harness();await h.window.myeventAttachCameraPhoto('event',new Blob(['video'],{type:'video/mp4'}));
 assert.equal(h.writes[0].path,'event/user/uuid-camera.mp4');assert.equal(h.writes[0].options.contentType,'video/mp4');assert.equal(h.writes[1].media_type,'video');
});
test('event photo retains existing JPEG path and type',async()=>{
 const h=harness();await h.window.myeventAttachCameraPhoto('event','data:image/jpeg;base64,test');assert.equal(h.writes[1].media_type,'image');assert.match(h.writes[0].path,/\.jpg$/);
});
test('failed metadata write removes the uploaded video and rejects publication',async()=>{
 const h=harness(new Error('RLS denied'));await assert.rejects(h.window.myeventAttachCameraPhoto('event',new Blob(['video'],{type:'video/webm'})),/RLS denied/);assert.deepEqual(h.removed,['event/user/uuid-camera.webm']);
});
test('unsupported media is rejected before uploading',async()=>{
 const h=harness();await assert.rejects(h.window.myeventAttachCameraPhoto('event',new Blob(['html'],{type:'text/html'})),/non prise en charge/);assert.equal(h.writes.length,0);
});
