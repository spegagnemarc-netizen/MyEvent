import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';
import vm from 'node:vm';
const source=readFileSync(new URL('../js/feed-composer-media.js',import.meta.url),'utf8');
const flush=()=>new Promise(r=>setImmediate(r));
function fixture(){
 const w=new JSDOM('<div id="socialComposerPanel" class="open"><textarea id="socialPostText"></textarea><div id="socialComposerMediaTools" hidden></div><button id="socialAddPhoto"></button><button id="socialAddVideo"></button><input type="file" id="socialPhotoInput"><input type="file" id="socialVideoInput"><div id="socialComposerMediaPreview" hidden></div><button id="socialPublishBtn"></button><button id="socialCancelPostBtn"></button><p id="socialPostMsg"></p></div><p id="socialFeedPublishStatus"></p>',{runScripts:'outside-only'}).window;
 let owner='a',url=0;const calls=[],revoked=[],d=w.document,$=id=>d.getElementById(id);
 w.URL.createObjectURL=()=>`blob:simulated-${++url}`;w.URL.revokeObjectURL=value=>revoked.push(value);
 w.HTMLMediaElement.prototype.pause=()=>{};
 w.Image=class{naturalWidth=800;naturalHeight=600;set src(v){queueMicrotask(()=>this.onload());}};
 w.HTMLCanvasElement.prototype.getContext=()=>({drawImage(){}});w.HTMLCanvasElement.prototype.toBlob=cb=>cb(new w.Blob(['jpeg'],{type:'image/jpeg'}));
 w.myeventRuntime={ready:Promise.resolve({environment:'preview',isTest:true,projectRef:'ahyyknfjsielnqyoxqgh'})};
 w.myeventCameraContext=()=>({user:owner?{id:owner}:null,sb:{from:table=>({insert:async row=>{calls.push({table,row});return {};}})}});
 w.myeventPublishFeedMedia=async(blob,body)=>{calls.push({blob,body});return {id:'saved',media_type:blob.type.startsWith('video/')?'video':'image'};};
 w.myeventRenderCameraFeedPost=row=>calls.push({render:row});w.myeventRefreshSocialFeed=async()=>calls.push({refresh:true});w.eval(source);
 return {w,$,calls,revoked,async select(kind,type){const input=$(kind==='image'?'socialPhotoInput':'socialVideoInput');Object.defineProperty(input,'files',{configurable:true,value:[new w.File(['media'],'sample',{type})]});input.dispatchEvent(new w.Event('change'));await flush();},session(id){owner=id;w.dispatchEvent(new w.Event('myevent-camera-feed-session'));}};
}
test('native picker button, JPEG preparation, preview removal and text-only path',async()=>{const f=fixture();try{await flush();let clicks=0;f.$('socialPhotoInput').click=()=>clicks++;f.$('socialAddPhoto').click();assert.equal(clicks,1);await f.select('image','image/heic');assert.equal(f.$('socialComposerMediaPreview').querySelector('img').src,'blob:simulated-2');f.$('socialRemoveMedia').click();assert(f.$('socialComposerMediaPreview').hidden);assert.equal(f.revoked.length,2);f.$('socialPostText').value='texte';f.$('socialPublishBtn').click();await flush();assert.equal(f.calls[0].table,'event_feed_posts');assert.equal(f.calls[0].row.body,'texte');}finally{f.w.close();}});
test('video plus text publishes once and renders a compact feed record',async()=>{const f=fixture();try{await f.select('video','video/mp4');assert(f.$('socialComposerMediaPreview').querySelector('video').controls);f.$('socialPostText').value='Ma vidéo';f.$('socialPublishBtn').click();f.$('socialPublishBtn').click();await flush();assert.equal(f.calls.filter(x=>x.blob).length,1);assert.equal(f.calls[0].body,'Ma vidéo');assert.equal(f.calls[1].render.media_type,'video');assert.match(f.$('socialFeedPublishStatus').textContent,/enregistrée/);assert(f.$('socialComposerMediaPreview').hidden);}finally{f.w.close();}});
test('photo without text is valid; provider rejection keeps draft and hides raw errors',async()=>{const f=fixture();try{await f.select('image','image/png');f.w.myeventPublishFeedMedia=async()=>{throw {code:'42501',message:'https://secret.invalid/token'};};f.$('socialPublishBtn').click();await flush();assert.match(f.$('socialPostMsg').textContent,/permissions TEST/);assert(!f.$('socialPostMsg').textContent.includes('secret'));assert(!f.$('socialComposerMediaPreview').hidden);assert(!f.$('socialPublishBtn').disabled);}finally{f.w.close();}});
test('unsupported video is rejected; session switch removes private draft',async()=>{const f=fixture();try{await f.select('video','video/avi');assert(f.$('socialComposerMediaPreview').hidden);assert.match(f.$('socialPostMsg').textContent,/ne peut pas/);await f.select('video','video/quicktime');f.$('socialPostText').value='private';f.session('b');assert.equal(f.$('socialPostText').value,'');assert(f.$('socialComposerMediaPreview').hidden);assert(f.revoked.length>0);}finally{f.w.close();}});
const core=readFileSync(new URL('../js/core-runtime.js',import.meta.url),'utf8');
function uploader({fail=false,config={environment:'preview',isTest:true,projectRef:'ahyyknfjsielnqyoxqgh'}}={}){
 const calls=[];const bucket={upload:async(path,blob,options)=>{calls.push({upload:path,options});return {};},remove:async paths=>{calls.push({remove:paths});return {};}};
 const sb={storage:{from:name=>{assert.equal(name,'social-media');return bucket;}},from:table=>({insert:row=>{calls.push({table,row});return {select:()=>({single:async()=>fail?{error:{code:'42501'}}:{data:{id:'saved',...row}}})};}})};
 const window={myeventRuntime:{ready:Promise.resolve(config)}};
 vm.runInNewContext(core.slice(core.indexOf('window.myeventPublishFeedMedia='),core.indexOf('window.myeventLoadCameraPosts=')),{window,user:{id:'owner'},sb,crypto:{randomUUID:()=> 'id'}});return {window,calls};
}
test('media uploader saves real metadata, uses no upsert and removes orphan on insert rejection',async()=>{const f=uploader();const row=await f.window.myeventPublishFeedMedia({type:'video/quicktime',size:10},' caption ');assert.equal(row.media_type,'video');assert.equal(row.content,'caption');assert.equal(f.calls[0].upload,'owner/id-feed.mov');assert.equal(f.calls[0].options.upsert,false);const failed=uploader({fail:true});await assert.rejects(failed.window.myeventPublishFeedMedia({type:'image/jpeg',size:10},''));assert.equal(failed.calls[2].remove[0],'owner/id-feed.jpg');});
test('media uploader refuses Production and oversized files before any storage call',async()=>{const f=uploader({config:{environment:'production',isTest:false,projectRef:'other'}});await assert.rejects(f.window.myeventPublishFeedMedia({type:'video/mp4',size:1}),/TEST_REQUIRED/);assert.equal(f.calls.length,0);const g=uploader();await assert.rejects(g.window.myeventPublishFeedMedia({type:'video/mp4',size:15728641}),/MEDIA_INVALID/);assert.equal(g.calls.length,0);});
